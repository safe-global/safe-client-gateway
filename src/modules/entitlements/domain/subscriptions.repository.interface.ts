// SPDX-License-Identifier: FSL-1.1-MIT
import type { EntityManager } from 'typeorm';
import type { SpaceSubscription } from '@/modules/entitlements/datasources/entities/space-subscription.entity.db';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';

export const ISubscriptionsRepository = Symbol('ISubscriptionsRepository');

/** Queries over the `subscriptions` table. */
export interface ISubscriptionsRepository {
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

  /** Demotes every active-ish row of the space other than the listed ones. */
  demoteActiveSubscriptions(
    args: {
      spaceId: Space['id'];
      exceptUpstreamSubscriptionIds: Array<string>;
    },
    entityManager?: EntityManager,
  ): Promise<void>;
}

export type SubscriptionValues = Pick<
  SpaceSubscription,
  'status' | 'planId' | 'planName' | 'currentPeriodStart' | 'currentPeriodEnd'
>;
