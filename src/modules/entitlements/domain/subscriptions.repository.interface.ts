// SPDX-License-Identifier: FSL-1.1-MIT
import type { EntityManager } from 'typeorm';
import type { SpaceSubscription } from '@/modules/entitlements/datasources/entities/space-subscription.entity.db';
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

  /** Every subscription of the workspace, active or terminal. */
  countSubscriptionsBySpaceId(
    spaceId: Space['id'],
    entityManager?: EntityManager,
  ): Promise<number>;

  getSubscriptionByUpstreamId(
    upstreamSubscriptionId: string,
    entityManager?: EntityManager,
  ): Promise<Pick<SpaceSubscription, 'id'> | null>;

  createSubscription(
    args: {
      spaceId: Space['id'];
      upstreamSubscriptionId: string;
      values: SubscriptionValues;
    },
    entityManager?: EntityManager,
  ): Promise<number>;

  updateSubscription(
    args: { id: number; values: SubscriptionValues },
    entityManager?: EntityManager,
  ): Promise<void>;
}

export type SubscriptionValues = Pick<
  SpaceSubscription,
  'status' | 'planId' | 'planName' | 'currentPeriodStart' | 'currentPeriodEnd'
>;
