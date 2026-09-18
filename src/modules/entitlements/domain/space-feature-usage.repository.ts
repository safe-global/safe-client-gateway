// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { z } from 'zod';
import { getScopedRepository } from '@/datasources/db/v2/get-scoped-repository.util';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { SpaceFeatureUsage } from '@/modules/entitlements/datasources/entities/space-feature-usage.entity.db';
import type {
  ISpaceFeatureUsageRepository,
  UsageKey,
} from '@/modules/entitlements/domain/space-feature-usage.repository.interface';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';

/** What the upsert returns: the counter's value after the write. */
const IncrementedUsageSchema = z
  .array(z.object({ used: z.number().int() }))
  .nonempty();

@Injectable()
export class SpaceFeatureUsageRepository
  implements ISpaceFeatureUsageRepository
{
  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  public async getUsageByFeatureId(
    args: { spaceId: Space['id']; periods: Array<UsageKey> },
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

  public async incrementUsage(
    args: { spaceId: Space['id']; period: UsageKey; delta: number },
    entityManager?: EntityManager,
  ): Promise<number> {
    const repository = await getScopedRepository(
      this.postgresDatabaseService,
      SpaceFeatureUsage,
      entityManager,
    );
    // Raw: `upsert()` overwrites `used` instead of adding to it, and
    // `orUpdate` assigns columns, not expressions.
    const rows = await repository.query<unknown>(
      `INSERT INTO "space_feature_usage" ("space_id", "feature_id", "period_start", "used")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("space_id", "feature_id", "period_start")
       DO UPDATE SET "used" = "space_feature_usage"."used" + EXCLUDED."used"
       RETURNING "used"`,
      [
        args.spaceId,
        args.period.featureId,
        args.period.periodStart,
        args.delta,
      ],
    );
    // Parsed: the driver hands rows back untyped, and `DO UPDATE` matching is
    // an expectation rather than a guarantee under a concurrent delete.
    const [row] = IncrementedUsageSchema.parse(rows);
    return row.used;
  }
}
