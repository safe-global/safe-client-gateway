// SPDX-License-Identifier: FSL-1.1-MIT
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { type FindOptionsWhere, IsNull, LessThan } from 'typeorm';
import type { Address } from 'viem';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { PostgresDatabaseService } from '#/datasources/db/v2/postgres-database.service';
import { PolicyConfigurationRequest } from '#/modules/policies/datasources/entities/policy-configuration-request.entity.db';
import type { PolicyConfigurationRequest as DomainPolicyConfigurationRequest } from '#/modules/policies/domain/entities/policy-configuration-request.entity';
import {
  type ActiveRootsRule,
  EVERY_ROOT_ACTIVE,
  type ISafePolicyGuardConfigurationRequestsRepository,
} from '#/modules/policies/domain/safe-policy-guard-configuration-requests.repository.interface';
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

      const stored = await repository.find({
        select: { root: true },
        where: safe,
      });
      // Re-submitting a stored root is a no-op, even at the cap.
      if (stored.some(({ root }) => root === args.root)) {
        return;
      }
      const active = stored.filter(({ root }) => activeRoots.get(root) ?? true);
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
