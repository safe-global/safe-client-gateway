// SPDX-License-Identifier: FSL-1.1-MIT
import type { Feature } from '@/modules/entitlements/datasources/entities/feature.entity.db';
import type { SpaceSubscription } from '@/modules/entitlements/datasources/entities/space-subscription.entity.db';
import type { SubscriptionEntitlement } from '@/modules/entitlements/datasources/entities/subscription-entitlement.entity.db';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';

/** One workspace's share of a {@link PlanContext}. */
export type SpacePlanContext = {
  spaceId: Space['id'];
  spaceCreatedAt: Date;
  activeSubscription: SpaceSubscription | null;
  purchased: Map<number, SubscriptionEntitlement>;
};

/**
 * Everything the entitlements of one or more workspaces are derived from, bar
 * their usage. The catalog and the clock are shared by all of them.
 */
export type PlanContext = {
  now: Date;
  features: Array<Feature>;
  spaces: Array<SpacePlanContext>;
};
