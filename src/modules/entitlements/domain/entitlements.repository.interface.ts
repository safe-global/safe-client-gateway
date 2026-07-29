// SPDX-License-Identifier: FSL-1.1-MIT
import type { EntityManager } from 'typeorm';
import type { FeatureKey } from '@/modules/entitlements/domain/entities/feature.entity';
import type { MaterializedSubscription } from '@/modules/entitlements/domain/entities/materialized-subscription.entity';
import type { ResolvedEntitlements } from '@/modules/entitlements/domain/entities/resolved-entitlements.entity';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';

export const IEntitlementsRepository = Symbol('IEntitlementsRepository');

export interface IEntitlementsRepository {
  /**
   * Resolves the full entitlement state of a workspace: active-subscription
   * package with Free-tier fallback, computed usage, derived grandfathering
   * and over-seat Safe ids.
   */
  resolveEntitlements(spaceId: Space['id']): Promise<ResolvedEntitlements>;

  /**
   * Enforcement primitive for stock-type metered features: throws
   * `QuotaExceededError` (402) when `used + increment` would exceed the
   * workspace's effective quota. `quota = NULL` (unlimited) never throws.
   * Pass the caller's `entityManager` to run the check inside the mutating
   * transaction.
   */
  checkQuotaOrFail(args: {
    spaceId: Space['id'];
    featureKey: FeatureKey;
    increment: number;
    entityManager?: EntityManager;
  }): Promise<void>;

  /**
   * Records event-type consumption (e.g. a gas-sponsored transaction) with an atomic,
   * period-keyed counter increment, enforcing the quota in the same
   * statement. Throws `QuotaExceededError` when over quota; unlimited
   * quotas always succeed.
   */
  consume(args: {
    spaceId: Space['id'];
    featureKey: FeatureKey;
    amount?: number;
  }): Promise<{ used: number; quota: number | null }>;

  /**
   * Idempotently materializes the upstream subscription state of a
   * workspace in one transaction: upserts every subscription row by
   * `upstreamSubscriptionId` and replaces the active subscription's
   * entitlement package wholesale.
   */
  materialize(args: {
    spaceId: Space['id'];
    subscriptions: Array<MaterializedSubscription>;
  }): Promise<void>;

  /**
   * Replaces the workspace admin's explicit choice of covered Safes
   * (validation — quota cap, Safe ownership — happens at the routes layer).
   */
  replaceSeatSelection(args: {
    spaceId: Space['id'];
    spaceSafeIds: Array<number>;
  }): Promise<void>;
}
