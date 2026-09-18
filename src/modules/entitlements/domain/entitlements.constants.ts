// SPDX-License-Identifier: FSL-1.1-MIT
import type { SubscriptionStatus } from '@/datasources/billing-api/entities/subscription.entity';
import {
  FEATURE_KEYS,
  FeatureType,
  SAFE_SEATS_FEATURE_KEY,
} from '@/modules/entitlements/domain/entities/feature.entity';

export const DAY_IN_MS = 24 * 60 * 60 * 1_000;

/**
 * Metered features whose usage is a live COUNT over a table another module
 * owns (Safes) rather than a `space_feature_usage` counter — storing it twice
 * would create a second source of truth that can drift. They have no reset
 * window (`resetsAt: null`).
 *
 * `EntitlementsService` maps each key to the repository call that counts it,
 * through an exhaustive `Record`, so adding one here fails to compile until
 * its counter is wired.
 */
export const STOCK_METERED_FEATURES = [
  SAFE_SEATS_FEATURE_KEY,
] as const satisfies ReadonlyArray<(typeof FEATURE_KEYS)[number]>;

export type StockMeteredFeature = (typeof STOCK_METERED_FEATURES)[number];

/** Takes the row, not the key, so a filtered array narrows without a cast. */
export function isStockMeteredFeatureKey(
  key: string,
): key is StockMeteredFeature {
  return (STOCK_METERED_FEATURES as ReadonlyArray<string>).includes(key);
}

export function isStockMeteredFeature<T extends { key: string }>(
  feature: T,
): feature is T & { key: StockMeteredFeature } {
  return isStockMeteredFeatureKey(feature.key);
}

/** The other half: metered, and counted in `space_feature_usage`. */
export function isEventMeteredFeature<T extends { key: string; type: string }>(
  feature: T,
): feature is T & { type: FeatureType.Metered } {
  return (
    feature.type === FeatureType.Metered && !isStockMeteredFeature(feature)
  );
}

/**
 * Subscription statuses that occupy a workspace's single "active
 * subscription" slot.
 *
 * The `UQ_subscriptions_active_space` partial unique index enforces the slot
 * in Postgres from its own frozen copy of this list, so changing this one
 * needs a paired migration reshaping that index — otherwise the database and
 * the application disagree on who holds the slot.
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
 * Whether `stamp` orders strictly after `mark`. Upstream's `created` has
 * second granularity, so two stamps in the same second say nothing about their
 * order — a tie is not "after" — and a stamp that is absent cannot be ordered
 * at all.
 */
export function ordersAfter(stamp: Date | null, mark: Date | null): boolean {
  if (stamp === null) return false;
  return mark === null || stamp > mark;
}

/**
 * Prefix of the Stripe metadata keys carrying the purchased feature package.
 * The Business plan sends `FEATURE_SAFE_SEATS=10`, `FEATURE_MEMBERS=5`,
 * `FEATURE_SECURITY_HUB=true`, `FEATURE_SHARED_ADDRESS_BOOK=true` and
 * `FEATURE_COPILOT_SCANS=true`; a key with no catalog row is dropped, so the
 * seed lags the plan until each feature is signed off.
 */
export const FEATURE_METADATA_PREFIX = 'FEATURE_';

/** The `safe_seats` metadata key, e.g. a payment link's `FEATURE_SAFE_SEATS`. */
export const SAFE_SEATS_METADATA_KEY = `${FEATURE_METADATA_PREFIX}${SAFE_SEATS_FEATURE_KEY.toUpperCase()}`;

export const PLAN_NAME_METADATA_KEY = 'planName';

/**
 * Metadata key marking which trial a payment link offers: `'true'` for the
 * legacy grace given to pre-enforcement workspaces, `'false'` for the standard
 * trial. Same upstream vocabulary as `PLAN_NAME_METADATA_KEY`.
 */
export const GRACE_PERIOD_METADATA_KEY = 'gracePeriod';

/**
 * Mirrors the `subscription_entitlements.value` column's `varchar(255)`: a
 * longer value is skipped rather than left to fail the insert.
 */
export const MAX_ENTITLEMENT_VALUE_LENGTH = 255;

/**
 * Value of a metered feature's metadata entry meaning "no quota, never
 * blocks" (materialized as `quota = NULL`).
 */
export const UNLIMITED_METADATA_VALUE = 'unlimited';
