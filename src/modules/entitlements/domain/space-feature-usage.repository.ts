// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { getScopedRepository } from '@/datasources/db/v2/get-scoped-repository.util';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { SpaceFeatureUsage } from '@/modules/entitlements/datasources/entities/space-feature-usage.entity.db';
import type {
  ISpaceFeatureUsageRepository,
  UsageKey,
} from '@/modules/entitlements/domain/space-feature-usage.repository.interface';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';

@Injectable()
export class SpaceFeatureUsageRepository
  implements ISpaceFeatureUsageRepository
{
  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  public async getUsageByFeatureId(
    args: { spaceId: Space['id']; periods: Array<Omit<UsageKey, 'spaceId'>> },
    entityManager?: EntityManager,
  ): Promise<Map<number, number>> {
    if (args.periods.length === 0) {
      return new Map();
    }
    const repository = await getScopedRepository(
      this.postgresDatabaseService,
      SpaceFeatureUsage,
      entityManager,
    );
    const rows = await repository.find({
      where: args.periods.map((period) => ({
        space: { id: args.spaceId },
        feature: { id: period.featureId },
        periodStart: period.periodStart,
      })),
      // Only the FK is needed; hydrating the feature row would be wasted work.
      loadRelationIds: { relations: ['feature'] },
    });
    return new Map(
      rows.flatMap((row) =>
        // With `loadRelationIds` the relation holds the raw id.
        row.feature ? [[Number(row.feature), row.used] as const] : [],
      ),
    );
  }
}
