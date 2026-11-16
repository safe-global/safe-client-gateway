// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { type EntityManager, Equal } from 'typeorm';
import { z } from 'zod';
import { getScopedRepository } from '#/datasources/db/v2/get-scoped-repository.util';
import { PostgresDatabaseService } from '#/datasources/db/v2/postgres-database.service';
import { SpaceFeatureUsage } from '#/modules/entitlements/datasources/entities/space-feature-usage.entity.db';
import type {
  ISpaceFeatureUsageRepository,
  UsageKey,
} from '#/modules/entitlements/domain/space-feature-usage.repository.interface';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';

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
    const usage = await this.getUsageBySpaceIds([args], entityManager);
    return usage.get(args.spaceId) ?? new Map();
  }

  public async getUsageBySpaceIds(
    args: Array<{ spaceId: Space['id']; periods: Array<UsageKey> }>,
    entityManager?: EntityManager,
  ): Promise<Map<Space['id'], Map<number, number>>> {
    const counters = args.flatMap(({ spaceId, periods }) =>
      periods.map((period) => ({ spaceId, ...period })),
    );
    if (counters.length === 0) {
      return new Map();
    }
    const repository = await getScopedRepository(
      this.postgresDatabaseService,
      SpaceFeatureUsage,
      entityManager,
    );
    const rows = await repository.find({
      where: counters.map((counter) => ({
        space: Equal(counter.spaceId),
        feature: Equal(counter.featureId),
        periodStart: counter.periodStart,
      })),
      // Only the FKs are needed; hydrating the rows would be wasted work.
      loadRelationIds: {
        relations: ['space', 'feature'],
        disableMixedMap: true,
      },
    });
    const usage = new Map<Space['id'], Map<number, number>>();
    for (const row of rows) {
      if (!(row.space && row.feature)) {
        continue;
      }
      const spaceUsage = usage.get(row.space.id) ?? new Map<number, number>();
      spaceUsage.set(row.feature.id, row.used);
      usage.set(row.space.id, spaceUsage);
    }
    return usage;
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
