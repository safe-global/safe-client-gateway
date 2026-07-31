// SPDX-License-Identifier: FSL-1.1-MIT
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { PolicyConfigurationRequest } from '@/modules/policies/datasources/entities/policy-configuration-request.entity.db';
import type { PolicyConfiguration } from '@/modules/policies/domain/entities/policy-configuration.entity';
import type { IPolicyConfigurationRequestsRepository } from '@/modules/policies/domain/policy-configuration-requests.repository.interface';

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
    const repository = await this.db.getRepository(PolicyConfigurationRequest);

    await this.assertBelowMaxPerSafe(args);

    // `ON CONFLICT DO NOTHING` on (chain_id, safe_address, root): re-submitting
    // a stored root is a no-op rather than an error, so a client retry is safe.
    await repository
      .createQueryBuilder()
      .insert()
      .values({
        chainId: args.chainId,
        safeAddress: args.safeAddress,
        root: args.root,
        configurations: [...args.configurations],
        spaceId: args.spaceId,
        createdBy: args.createdBy,
      })
      .orIgnore()
      .execute();
  }

  public async findBySafe(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<Array<PolicyConfigurationRequest>> {
    const repository = await this.db.getRepository(PolicyConfigurationRequest);

    return await repository.find({
      where: { chainId: args.chainId, safeAddress: args.safeAddress },
      order: { createdAt: 'DESC', id: 'DESC' },
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
