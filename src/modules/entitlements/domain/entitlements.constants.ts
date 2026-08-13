// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type SubscriptionStatus,
  SubscriptionStatusSchema,
} from '@/datasources/billing-api/entities/subscription.entity';

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

export function isActiveSubscriptionStatus(
  status: SubscriptionStatus,
): boolean {
  return (ACTIVE_SUBSCRIPTION_STATUSES as ReadonlyArray<string>).includes(
    status,
  );
}

/**
 * Narrows an upstream status string to the domain enum, or `null` when it is
 * one this service does not know — a status added upstream must not fail the
 * webhook, so the caller decides what to do instead.
 */
export function parseSubscriptionStatus(
  status: string | null | undefined,
): SubscriptionStatus | null {
  const result = SubscriptionStatusSchema.safeParse(status);
  return result.success ? result.data : null;
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
