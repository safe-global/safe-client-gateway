// SPDX-License-Identifier: FSL-1.1-MIT
import type { SubscriptionStatus } from '@/datasources/billing-api/entities/subscription.entity';

/**
 * The date feature-gating enforcement went live.
 *
 * Grandfathering is derived (never stored): a workspace is grandfathered on a
 * metered feature when it was created before this date, has NEVER had a
 * subscription, and its usage exceeds the Free quota. Buying any plan creates
 * a `subscriptions` row and permanently ends the protection.
 */
// TODO(entitlements): set the real launch date before enabling enforcement
// in production (pending product sign-off).
export const ENFORCEMENT_LAUNCH_DATE = new Date('2026-07-01T00:00:00Z');

/**
 * Prefix of the Stripe metadata keys carrying the purchased feature package,
 * e.g. `FEATURE_SAFE_SEATS=10`, `FEATURE_SECURITY_HUB=true`,
 * `FEATURE_SPONSORED_TRANSACTIONS=unlimited`, `FEATURE_SWAP_FEE_TIER=business`.
 */
export const FEATURE_METADATA_PREFIX = 'FEATURE_';

/**
 * Value of a metered feature's metadata entry meaning "no quota, never
 * blocks" (materialized as `quota = NULL`).
 */
export const UNLIMITED_METADATA_VALUE = 'unlimited';

/**
 * Metered features whose usage is a live COUNT over an existing table
 * (space_safes, members) rather than a `space_feature_usage` counter —
 * storing them again would create a second source of truth that can drift.
 * They have no reset window (`resetsAt: null`).
 */
export const STOCK_METERED_FEATURES = ['safe_seats', 'members'] as const;

export type StockMeteredFeature = (typeof STOCK_METERED_FEATURES)[number];

export function isStockMeteredFeature(key: string): key is StockMeteredFeature {
  return (STOCK_METERED_FEATURES as ReadonlyArray<string>).includes(key);
}

/**
 * Subscription statuses that occupy a workspace's single "active
 * subscription" slot (mirrors the partial unique index on `subscriptions`).
 * `past_due`/`paused`/`unpaid` keep the package attached so the UI can drive
 * the payment-failed flow; only truly terminal statuses free the slot.
 */
export const ACTIVE_SUBSCRIPTION_STATUSES = [
  'active',
  'trialing',
  'past_due',
  'paused',
  'unpaid',
] as const satisfies ReadonlyArray<SubscriptionStatus>;

export type ActiveSubscriptionStatus =
  (typeof ACTIVE_SUBSCRIPTION_STATUSES)[number];

export function isActiveSubscriptionStatus(
  status: string,
): status is ActiveSubscriptionStatus {
  return (ACTIVE_SUBSCRIPTION_STATUSES as ReadonlyArray<string>).includes(
    status,
  );
}
