// SPDX-License-Identifier: FSL-1.1-MIT
import type { SubscriptionStatus } from '@/datasources/billing-api/entities/subscription.entity';

/**
 * Subscription statuses that occupy a workspace's single "active
 * subscription" slot.
 */
export const ACTIVE_SUBSCRIPTION_STATUSES = [
  'active',
  'trialing',
] as const satisfies ReadonlyArray<SubscriptionStatus>;

export function isActiveSubscriptionStatus(
  status: SubscriptionStatus,
): boolean {
  return (ACTIVE_SUBSCRIPTION_STATUSES as ReadonlyArray<string>).includes(
    status,
  );
}

/**
 * Prefix of the Stripe metadata keys carrying the purchased feature package,
 * e.g. `FEATURE_SAFE_SEATS=10`, `FEATURE_SECURITY_HUB=true`,
 * `FEATURE_SPONSORED_TRANSACTIONS=unlimited`, `FEATURE_SWAP_FEE_TIER=business`.
 */
export const FEATURE_METADATA_PREFIX = 'FEATURE_';

export const PLAN_NAME_METADATA_KEY = 'planName';

/**
 * Value of a metered feature's metadata entry meaning "no quota, never
 * blocks" (materialized as `quota = NULL`).
 */
export const UNLIMITED_METADATA_VALUE = 'unlimited';
