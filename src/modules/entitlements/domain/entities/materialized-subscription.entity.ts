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
  quota: number | null;
  value: string | null;
};

/**
 * An upstream subscription mapped to its materialized shape, ready to be
 * upserted by `EntitlementsService.materialize`.
 */
export type MaterializedSubscription = {
  upstreamSubscriptionId: string;
  status: SubscriptionStatus;
  planId: string;
  planName: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  entitlements: Array<ParsedEntitlement> | null;
};
