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

  public async getUsage(
    key: UsageKey,
    entityManager?: EntityManager,
  ): Promise<number> {
    const repository = await getScopedRepository(
      this.postgresDatabaseService,
      SpaceFeatureUsage,
      entityManager,
    );
    const usage = await repository.findOne({
      where: {
        space: { id: key.spaceId },
        feature: { id: key.featureId },
        periodStart: key.periodStart,
      },
    });
    return usage?.used ?? 0;
  }

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
        row.feature
          ? [[row.feature as unknown as number, row.used] as const]
          : [],
      ),
    );
  }

  public async createUsageIfMissing(
    key: UsageKey,
    entityManager?: EntityManager,
  ): Promise<void> {
    const repository = await getScopedRepository(
      this.postgresDatabaseService,
      SpaceFeatureUsage,
      entityManager,
    );
    await repository.query(
      `INSERT INTO space_feature_usage ("space_id", "feature_id", "period_start", "used")
       VALUES ($1, $2, $3, 0)
       ON CONFLICT ON CONSTRAINT "UQ_SFU_space_feature_period" DO NOTHING`,
      [key.spaceId, key.featureId, key.periodStart],
    );
  }

  public async increaseUsageWithinQuota(
    args: UsageKey & { amount: number; quota: number | null },
    entityManager?: EntityManager,
  ): Promise<number | null> {
    const repository = await getScopedRepository(
      this.postgresDatabaseService,
      SpaceFeatureUsage,
      entityManager,
    );
    // TypeORM returns UPDATE ... RETURNING results as [rows, rowCount].
    const [rows]: [Array<{ used: number }>, number] = await repository.query(
      `UPDATE space_feature_usage
       SET "used" = "used" + $4
       WHERE "space_id" = $1 AND "feature_id" = $2 AND "period_start" = $3
         AND ($5::integer IS NULL OR "used" + $4 <= $5)
       RETURNING "used"`,
      [args.spaceId, args.featureId, args.periodStart, args.amount, args.quota],
    );
    return rows.length === 0 ? null : rows[0].used;
  }
}
