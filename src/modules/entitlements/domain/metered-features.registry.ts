// SPDX-License-Identifier: FSL-1.1-MIT
import type { EntityTarget, FindOptionsWhere, ObjectLiteral } from 'typeorm';
import type { FeatureKey } from '@/modules/entitlements/domain/entities/feature.entity';
import { SpaceSafe } from '@/modules/spaces/datasources/safes/entities/space-safes.entity.db';
import type { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { activeOrPendingMemberWhere } from '@/modules/users/domain/members/utils/members.utils';

/**
 * Where a stock-metered feature's usage is read from: a live COUNT over the
 * table that already owns the data, instead of a `space_feature_usage`
 * counter — storing it twice would create a second source of truth that can
 * drift. Stock features have no reset window (`resetsAt: null`).
 */
export type StockMeteredSource = {
  entity: EntityTarget<ObjectLiteral>;
  /** Rows of that table which currently hold one unit of the workspace quota. */
  where: (
    spaceId: Space['id'],
  ) => FindOptionsWhere<ObjectLiteral> | Array<FindOptionsWhere<ObjectLiteral>>;
};

/**
 * The single place that defines how each stock-metered feature is counted.
 *
 * Everything downstream — the enforcement primitive, the entitlements
 * resolver and the reset-window logic — dispatches through this registry, so
 * adding a stock-metered feature is one entry here plus its catalog row. No
 * call site learns the new key.
 */
export const STOCK_METERED_SOURCES = {
  safe_seats: {
    entity: SpaceSafe,
    where: (spaceId) => ({ space: { id: spaceId } }),
  },
  members: {
    // ACTIVE members and pending (non-expired) invites both hold a seat.
    entity: Member,
    where: (spaceId) =>
      activeOrPendingMemberWhere<Member>(() => ({ space: { id: spaceId } })),
  },
} as const satisfies Partial<Record<FeatureKey, StockMeteredSource>>;

export type StockMeteredFeature = keyof typeof STOCK_METERED_SOURCES;

export const STOCK_METERED_FEATURES = Object.keys(
  STOCK_METERED_SOURCES,
) as Array<StockMeteredFeature>;

export function isStockMeteredFeature(key: string): key is StockMeteredFeature {
  return key in STOCK_METERED_SOURCES;
}
