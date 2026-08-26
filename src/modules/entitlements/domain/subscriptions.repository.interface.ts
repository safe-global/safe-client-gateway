// SPDX-License-Identifier: FSL-1.1-MIT
import type { EntityManager } from 'typeorm';
import type { SpaceSubscription } from '@/modules/entitlements/datasources/entities/space-subscription.entity.db';
import type { SubscriptionValues } from '@/modules/entitlements/domain/entities/space-subscription.entity';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';

export const ISubscriptionsRepository = Symbol('ISubscriptionsRepository');

/** Queries over the `subscriptions` table. */
export interface ISubscriptionsRepository {
  /**
   * The subscription holding the workspace's single active slot, with its
   * entitlement package and each row's feature.
   */
  getActiveSubscriptionBySpaceId(
    spaceId: Space['id'],
    entityManager?: EntityManager,
  ): Promise<SpaceSubscription | null>;

  /**
   * Whether the space ever held a subscription, in any status — terminal and
   * incomplete rows included.
   */
  hasAnySubscription(spaceId: Space['id']): Promise<boolean>;

  /**
   * Plan name on the workspace's active subscription; `null` when it has none
   * or the row is untagged. Reads only that column — prefer it over
   * `getActiveSubscriptionBySpaceId` when the entitlement package is not needed.
   */
  getActivePlanName(spaceId: Space['id']): Promise<string | null>;

  /**
   * Atomic upsert by `upstreamSubscriptionId`: inserts a new row, or updates
   * the existing one in place if the id is already known.
   */
  upsertSubscription(
    args: {
      spaceId: Space['id'];
      upstreamSubscriptionId: string;
      values: SubscriptionValues;
    },
    entityManager?: EntityManager,
  ): Promise<number>;

  /** Demotes every active-ish row of the space other than the named one. */
  demoteActiveSubscriptions(
    args: {
      spaceId: Space['id'];
      exceptUpstreamSubscriptionId: string;
      lastEventAt: Date | null;
    },
    entityManager?: EntityManager,
  ): Promise<void>;

  /**
   * Newest event stamp materialized for the space, across all its
   * subscriptions — `null` when it has none, or when none was written by an
   * event carrying a `created` stamp. Read it inside the transaction that
   * holds `lockSpaceForSync` to compare it against an incoming event.
   */
  getLastEventAt(
    spaceId: Space['id'],
    entityManager?: EntityManager,
  ): Promise<Date | null>;

  /**
   * Transaction-scoped Postgres lock serializing webhook materialization for a
   * workspace, released when `entityManager`'s transaction ends. Not a query
   * over this table's rows — it lives here because the rows it protects are
   * this repository's, and it holds even for a space that has none yet, which
   * a `SELECT … FOR UPDATE` over those rows could not.
   */
  lockSpaceForSync(
    spaceId: Space['id'],
    entityManager: EntityManager,
  ): Promise<void>;
}
