// SPDX-License-Identifier: FSL-1.1-MIT
import type { EntityManager } from 'typeorm';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';

export const ISpaceFeatureUsageRepository = Symbol(
  'ISpaceFeatureUsageRepository',
);

/** A counter's key within a space: which feature, which period. */
export type UsageKey = {
  featureId: number;
  periodStart: Date;
};

/** Queries over the `space_feature_usage` counters. */
export interface ISpaceFeatureUsageRepository {
  /** Counters of several (feature, period) pairs, keyed by feature id. */
  getUsageByFeatureId(
    args: { spaceId: Space['id']; periods: Array<UsageKey> },
    entityManager?: EntityManager,
  ): Promise<Map<number, number>>;

  /**
   * Adds `delta` to one counter, creating it when the period has none yet, and
   * returns what it holds afterwards — subtract `delta` for the `used` a quota
   * check expects. Creating and incrementing are one statement, so concurrent
   * callers queue on the row instead of overshooting a quota together; a
   * caller that passes its `entityManager` releases the count by rolling back.
   */
  incrementUsage(
    args: { spaceId: Space['id']; period: UsageKey; delta: number },
    entityManager?: EntityManager,
  ): Promise<number>;
}
