// SPDX-License-Identifier: FSL-1.1-MIT
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { type FindOptionsWhere, IsNull, LessThan } from 'typeorm';
import type { Address } from 'viem';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { PostgresDatabaseService } from '#/datasources/db/v2/postgres-database.service';
import { PolicyConfigurationRequest } from '#/modules/policies/datasources/entities/policy-configuration-request.entity.db';
import type { PolicyConfigurationRequest as DomainPolicyConfigurationRequest } from '#/modules/policies/domain/entities/policy-configuration-request.entity';
import type { SafeRef } from '#/modules/policies/domain/entities/safe-ref.entity';
import {
  type StoredPolicyConfiguration,
  StoredPolicyConfigurationSchema,
} from '#/modules/policies/domain/entities/stored-policy-configuration.entity';
import type { ISafePolicyGuardConfigurationRequestsRepository } from '#/modules/policies/domain/safe-policy-guard-configuration-requests.repository.interface';
import { SpaceEncryptionService } from '#/modules/spaces/domain/space-encryption.service';

@Injectable()
export class SafePolicyGuardConfigurationRequestsRepository
  implements ISafePolicyGuardConfigurationRequestsRepository
{
  private readonly maxPerSpaceSafe: number;
  private readonly retentionDays: number;

  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly db: PostgresDatabaseService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(SpaceEncryptionService)
    private readonly spaceEncryptionService: SpaceEncryptionService,
  ) {
    this.maxPerSpaceSafe = this.configurationService.getOrThrow<number>(
      'policies.maxConfigurationRequestsPerSpaceSafe',
    );
    this.retentionDays = this.configurationService.getOrThrow<number>(
      'policies.configurationRequestRetentionDays',
    );
  }

  public async create(
    args: Omit<DomainPolicyConfigurationRequest, 'id' | 'createdAt'>,
  ): Promise<void> {
    const safeAddressIndex = this.spaceEncryptionService.safeAddressIndex(
      args.safeAddress,
    );
    const safeAddress = await this.spaceEncryptionService.encryptSafeAddress(
      args.spaceId,
      args.safeAddress,
    );

    await this.db.transaction(async (manager) => {
      // Serialises writes per Space and Safe, so concurrent requests cannot
      // pass the cap together.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `${args.spaceId}:${args.chainId}:${args.safeAddress}`,
      ]);
      const repository = manager.getRepository(PolicyConfigurationRequest);
      const safe = this.safeMatch({ ...args, safeAddressIndex });

      // Re-submitting a stored root is a no-op, even at the cap.
      if (await repository.existsBy({ ...safe, root: args.root })) {
        return;
      }
      if ((await repository.countBy(safe)) >= this.maxPerSpaceSafe) {
        throw new BadRequestException(
          `This Safe only allows a maximum of ${this.maxPerSpaceSafe} stored policy configuration requests in this space.`,
        );
      }
      await repository.insert({
        ...args,
        safeAddress: safeAddress as Address,
        safeAddressIndex,
      });
    });
  }

  /** Deletes the requests stored longer than the retention period. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM, {
    disabled: process.env.NODE_ENV === 'test',
  })
  public async prune(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.retentionDays);

    const repository = await this.db.getRepository(PolicyConfigurationRequest);
    await repository.delete({ createdAt: LessThan(cutoff) });
  }

  /**
   * The configurations stored for {@link args.safes} in one Space, oldest
   * first, in one query matched like {@link create} matches a Safe.
   */
  public async findBySafes(args: {
    spaceId: number;
    safes: ReadonlyArray<SafeRef>;
  }): Promise<Array<StoredPolicyConfiguration>> {
    if (args.safes.length === 0) {
      return [];
    }
    // Keyed by chain and blind index (or plaintext address), as rows store it.
    const safesByKey = new Map(
      args.safes.map((safe) => {
        const index = this.spaceEncryptionService.safeAddressIndex(
          safe.address,
        );
        return [`${safe.chainId}:${index ?? safe.address}`, { safe, index }];
      }),
    );

    const repository = await this.db.getRepository(PolicyConfigurationRequest);
    const rows = await repository.find({
      where: [...safesByKey.values()].map(({ safe, index }) =>
        this.safeMatch({
          spaceId: args.spaceId,
          chainId: safe.chainId,
          safeAddress: safe.address,
          safeAddressIndex: index,
        }),
      ),
      order: { createdAt: 'ASC' },
    });

    // The stored address may be ciphertext; report the one the caller asked for.
    return rows.flatMap((row) => {
      const match = safesByKey.get(
        `${row.chainId}:${row.safeAddressIndex ?? row.safeAddress}`,
      );
      return match
        ? [
            StoredPolicyConfigurationSchema.parse({
              chainId: row.chainId,
              safeAddress: match.safe.address,
              root: row.root,
              configurations: row.configurations,
              createdAt: row.createdAt,
            }),
          ]
        : [];
    });
  }

  /**
   * Matches the rows of one Safe in one Space. Encryption disabled: the
   * address is plaintext and the index NULL. Otherwise only the blind index
   * can be compared.
   */
  private safeMatch(args: {
    spaceId: number;
    chainId: string;
    safeAddress: Address;
    safeAddressIndex: string | null;
  }): FindOptionsWhere<PolicyConfigurationRequest> {
    return args.safeAddressIndex === null
      ? {
          spaceId: args.spaceId,
          chainId: args.chainId,
          safeAddressIndex: IsNull(),
          safeAddress: args.safeAddress,
        }
      : {
          spaceId: args.spaceId,
          chainId: args.chainId,
          safeAddressIndex: args.safeAddressIndex,
        };
  }
}
