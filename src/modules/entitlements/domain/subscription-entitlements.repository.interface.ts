// SPDX-License-Identifier: FSL-1.1-MIT
import type { EntityManager } from 'typeorm';

export const ISubscriptionEntitlementsRepository = Symbol(
  'ISubscriptionEntitlementsRepository',
);

export type SubscriptionEntitlementValues = {
  featureId: number;
  enabled: boolean;
  quota: number | null;
  value: string | null;
};

/** Queries over the `subscription_entitlements` table. */
export interface ISubscriptionEntitlementsRepository {
  deleteEntitlementsBySubscriptionId(
    subscriptionId: number,
    entityManager?: EntityManager,
  ): Promise<void>;

  createEntitlements(
    args: {
      subscriptionId: number;
      entitlements: Array<SubscriptionEntitlementValues>;
    },
    entityManager?: EntityManager,
  ): Promise<void>;
}
