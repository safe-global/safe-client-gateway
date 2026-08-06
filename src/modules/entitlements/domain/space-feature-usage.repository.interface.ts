// SPDX-License-Identifier: FSL-1.1-MIT
import type { EntityManager } from 'typeorm';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';

export const ISpaceFeatureUsageRepository = Symbol(
  'ISpaceFeatureUsageRepository',
);

export type UsageKey = {
  spaceId: Space['id'];
  featureId: number;
  periodStart: Date;
};

/** Queries over the `space_feature_usage` counters. */
export interface ISpaceFeatureUsageRepository {
  /** Counter of the given period, 0 when the row does not exist yet. */
  getUsage(key: UsageKey, entityManager?: EntityManager): Promise<number>;

  /** Counters of several (feature, period) pairs, keyed by feature id. */
  getUsageByFeatureId(
    args: { spaceId: Space['id']; periods: Array<Omit<UsageKey, 'spaceId'>> },
    entityManager?: EntityManager,
  ): Promise<Map<number, number>>;

  /** Creates the period row when missing; leaves an existing one untouched. */
  createUsageIfMissing(
    key: UsageKey,
    entityManager?: EntityManager,
  ): Promise<void>;

  /**
   * Adds `amount` to the period counter only while the result stays within
   * `quota` (NULL = unlimited), and returns the new total — or null when the
   * increment was rejected. Guard and increment are one statement, so
   * concurrent consumers cannot overshoot.
   */
  increaseUsageWithinQuota(
    args: UsageKey & { amount: number; quota: number | null },
    entityManager?: EntityManager,
  ): Promise<number | null>;
}
