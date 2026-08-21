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
}
