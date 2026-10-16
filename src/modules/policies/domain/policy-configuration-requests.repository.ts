// SPDX-License-Identifier: FSL-1.1-MIT
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { type FindOptionsWhere, IsNull } from 'typeorm';
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
import {
  type ActiveRootsRule,
  EVERY_ROOT_ACTIVE,
  type IPolicyConfigurationRequestsRepository,
} from '#/modules/policies/domain/policy-configuration-requests.repository.interface';
import { SpaceEncryptionService } from '#/modules/spaces/domain/space-encryption.service';

@Injectable()
export class PolicyConfigurationRequestsRepository
  implements IPolicyConfigurationRequestsRepository
{
  private readonly maxPerSpaceSafe: number;

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
  }

  public async create(
    args: Omit<DomainPolicyConfigurationRequest, 'id' | 'createdAt'>,
    activeRoots: ActiveRootsRule = EVERY_ROOT_ACTIVE,
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
      const stored = await repository.find({
        select: { root: true, createdAt: true },
        where: safe,
      });
      const active = stored.filter(
        ({ root, createdAt }) =>
          activeRoots.onChain.get(root) ??
          (activeRoots.draftsSince === null ||
            createdAt >= activeRoots.draftsSince),
      );
      if (active.length >= this.maxPerSpaceSafe) {
        throw new BadRequestException(
          `This Safe only allows a maximum of ${this.maxPerSpaceSafe} active policy configuration requests in this space.`,
        );
      }
      await repository.insert({
        ...args,
        safeAddress: safeAddress as Address,
        safeAddressIndex,
      });
    });
  }

  /**
   * The configurations stored for {@link args.safes} in one Space, oldest
   * first. Reads the whole Space by `space_id` and matches rows in memory, so a
   * Workspace-wide read is one indexed query.
   */
  public async findBySafes(args: {
    spaceId: number;
    safes: ReadonlyArray<SafeRef>;
  }): Promise<Array<StoredPolicyConfiguration>> {
    if (args.safes.length === 0) {
      return [];
    }
    const matches = args.safes.map((safe) => ({
      safe,
      safeAddressIndex: this.spaceEncryptionService.safeAddressIndex(
        safe.address,
      ),
    }));

    const repository = await this.db.getRepository(PolicyConfigurationRequest);
    const rows = await repository.find({
      where: { spaceId: args.spaceId },
      order: { createdAt: 'ASC' },
    });

    // The stored address may be ciphertext; report the one the caller asked for.
    return rows.flatMap((row) => {
      const match = matches.find(
        ({ safe, safeAddressIndex }) =>
          safe.chainId === row.chainId &&
          (safeAddressIndex ?? safe.address) ===
            (row.safeAddressIndex ?? row.safeAddress),
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
