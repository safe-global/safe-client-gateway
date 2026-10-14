// SPDX-License-Identifier: FSL-1.1-MIT
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';
import { z } from 'zod';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { PostgresDatabaseService } from '#/datasources/db/v2/postgres-database.service';
import { PolicyConfigurationRecord } from '#/modules/policies/datasources/entities/policy-configuration.entity.db';
import { PolicyConfigurationRequest } from '#/modules/policies/datasources/entities/policy-configuration-request.entity.db';
import type { PolicyConfiguration } from '#/modules/policies/domain/entities/policy-configuration.entity';
import type { IPolicyConfigurationRequestsRepository } from '#/modules/policies/domain/policy-configuration-requests.repository.interface';

/**
 * The `RETURNING "id"` of the request insert: one row when it was inserted, none
 * when `ON CONFLICT DO NOTHING` skipped it. `bigint` arrives as a string.
 */
const InsertedRequestSchema = z.array(z.object({ id: z.string() })).max(1);

@Injectable()
export class PolicyConfigurationRequestsRepository
  implements IPolicyConfigurationRequestsRepository
{
  private readonly maxPerSafe: number;

  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly db: PostgresDatabaseService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.maxPerSafe = this.configurationService.getOrThrow<number>(
      'policies.maxConfigurationRequestsPerSafe',
    );
  }

  public async create(args: {
    chainId: string;
    safeAddress: Address;
    root: Hex;
    configurations: ReadonlyArray<PolicyConfiguration>;
    spaceId: number;
    createdBy: number;
  }): Promise<void> {
    await this.assertBelowMaxPerSafe(args);

    // The request and its configurations land together or not at all.
    await this.db.transaction(async (manager) => {
      // `ON CONFLICT DO NOTHING` on (chain_id, safe_address, root): re-submitting
      // a stored root is a no-op rather than an error, so a client retry is safe.
      const { raw } = await manager
        .createQueryBuilder()
        .insert()
        .into(PolicyConfigurationRequest)
        .values({
          chainId: args.chainId,
          safeAddress: args.safeAddress,
          root: args.root,
          spaceId: args.spaceId,
          createdBy: args.createdBy,
        })
        .orIgnore()
        .returning(['id'])
        .execute();

      const [inserted] = InsertedRequestSchema.parse(raw);

      // A re-submission inserted no request, and its configurations are the
      // ones already stored: the same root hashes the same configurations.
      if (!inserted) {
        return;
      }

      await manager
        .createQueryBuilder()
        .insert()
        .into(PolicyConfigurationRecord)
        .values(
          args.configurations.map((configuration, position) => ({
            requestId: inserted.id,
            position,
            target: configuration.target,
            selector: configuration.selector,
            operation: configuration.operation,
            policy: configuration.policy,
            data: configuration.data,
          })),
        )
        .execute();
    });
  }

  /**
   * Bounds how many requests a Safe can store, so a client cannot fill the table
   * by submitting configurations for roots it keeps requesting.
   *
   * A stored root that is already applied or invalidated is pruned elsewhere, so
   * hitting the cap means an unusual number of *open* requests.
   */
  private async assertBelowMaxPerSafe(args: {
    chainId: string;
    safeAddress: Address;
    root: Hex;
  }): Promise<void> {
    const repository = await this.db.getRepository(PolicyConfigurationRequest);

    const [stored, isKnownRoot] = await Promise.all([
      repository.countBy({
        chainId: args.chainId,
        safeAddress: args.safeAddress,
      }),
      repository.existsBy({
        chainId: args.chainId,
        safeAddress: args.safeAddress,
        root: args.root,
      }),
    ]);

    // An idempotent re-submission adds no row, so it must not be rejected.
    if (!isKnownRoot && stored >= this.maxPerSafe) {
      throw new BadRequestException(
        `This Safe only allows a maximum of ${this.maxPerSafe} stored policy configuration requests.`,
      );
    }
  }
}
