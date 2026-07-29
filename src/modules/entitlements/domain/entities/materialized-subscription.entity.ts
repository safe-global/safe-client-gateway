// SPDX-License-Identifier: FSL-1.1-MIT
import type { SubscriptionStatus } from '@/datasources/billing-api/entities/subscription.entity';
import type { FeatureKey } from '@/modules/entitlements/domain/entities/feature.entity';

/**
 * One entry of a purchased feature package, parsed from the upstream
 * subscription's `FEATURE_*` metadata (see `parseFeaturePackage`).
 */
export type ParsedEntitlement = {
  featureKey: FeatureKey;
  enabled: boolean;
  /** NULL = unlimited (metered only). */
  quota: number | null;
  /** Non-boolean tiers (value-typed only). */
  value: string | null;
};

/**
 * An upstream subscription mapped to its materialized shape, ready to be
 * upserted by `IEntitlementsRepository.materialize`.
 */
export type MaterializedSubscription = {
  upstreamSubscriptionId: string;
  status: SubscriptionStatus;
  planId: string;
  planName: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  /**
   * The purchased package. Non-null only for the subscription holding the
   * workspace's active slot: its `subscription_entitlements` rows are
   * replaced wholesale (idempotent).
   */
  entitlements: Array<ParsedEntitlement> | null;
};
