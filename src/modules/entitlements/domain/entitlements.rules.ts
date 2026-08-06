// SPDX-License-Identifier: FSL-1.1-MIT
import { ENFORCEMENT_LAUNCH_DATE } from '@/modules/entitlements/domain/entitlements.constants';
import { isStockMeteredFeature } from '@/modules/entitlements/domain/metered-features.registry';

/**
 * The entitlement rules of the RFC as pure functions: no database, no Nest, no
 * entity classes. Everything derived — the Free-tier fallback, the usage
 * window, grandfathering and over-seat coverage — is decided here, so the
 * repository stays a data-access layer and these rules can be unit-tested
 * without a database.
 */

const DAY_IN_MS = 24 * 60 * 60 * 1_000;

/** Only the catalog fields the rules need, so entity classes stay out. */
export type FeatureDefaults = {
  key: string;
  freeEnabled: boolean;
  freeQuota: number | null;
  freeValue: string | null;
  /** Free usage window in days (event-metered only). */
  freePeriod: number | null;
};

/** The purchased row for a feature, when the workspace has one. */
export type PurchasedEntitlement = {
  enabled: boolean;
  quota: number | null;
  value: string | null;
};

/** The active subscription's billing cycle, or null on the Free plan. */
export type BillingCycle = {
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
} | null;

/**
 * The effective entitlement of one feature: the purchased package wins,
 * otherwise the catalog's Free defaults. Both branches produce the same shape,
 * so consumers never know which one served them.
 */
export function effectiveEntitlement(args: {
  feature: FeatureDefaults;
  purchased: PurchasedEntitlement | undefined;
}): PurchasedEntitlement {
  const { feature, purchased } = args;
  return purchased
    ? {
        enabled: purchased.enabled,
        quota: purchased.quota,
        value: purchased.value,
      }
    : {
        enabled: feature.freeEnabled,
        quota: feature.freeQuota,
        value: feature.freeValue,
      };
}

/** A disabled metered feature admits no usage at all; NULL stays unlimited. */
export function enforceableQuota(
  effective: PurchasedEntitlement,
): number | null {
  return effective.enabled ? effective.quota : 0;
}

/**
 * Start of the current usage period of an event-metered feature.
 *
 * Paid workspaces anchor on the billing cycle; free ones bucket usage in
 * `freePeriod`-day windows anchored at the workspace's creation date
 * (`periodStart = createdAt + floor((now - createdAt) / period) * period`).
 * Without a window the whole lifetime is a single bucket.
 */
export function eventPeriodStart(args: {
  feature: FeatureDefaults;
  spaceCreatedAt: Date;
  cycle: BillingCycle;
  now: Date;
}): Date {
  const { feature, spaceCreatedAt, cycle, now } = args;
  if (cycle?.currentPeriodStart) {
    return cycle.currentPeriodStart;
  }
  if (feature.freePeriod !== null) {
    const anchor = spaceCreatedAt.getTime();
    const periodMs = feature.freePeriod * DAY_IN_MS;
    const elapsed = Math.max(0, now.getTime() - anchor);
    return new Date(anchor + Math.floor(elapsed / periodMs) * periodMs);
  }
  return spaceCreatedAt;
}

/** When the current quota window rolls over; NULL for stock-type features. */
export function resetsAt(args: {
  feature: FeatureDefaults;
  spaceCreatedAt: Date;
  cycle: BillingCycle;
  now: Date;
}): Date | null {
  const { feature, cycle } = args;
  if (isStockMeteredFeature(feature.key)) {
    return null;
  }
  if (cycle?.currentPeriodStart) {
    return cycle.currentPeriodEnd;
  }
  if (feature.freePeriod !== null) {
    return new Date(
      eventPeriodStart(args).getTime() + feature.freePeriod * DAY_IN_MS,
    );
  }
  return null;
}

/**
 * Grandfathering, derived and never stored: the workspace predates enforcement,
 * has NEVER had a subscription, and is over its Free quota. Buying any plan
 * creates a subscription row and permanently ends the protection — there is no
 * path back into it.
 */
export function isGrandfathered(args: {
  spaceCreatedAt: Date;
  hasEverSubscribed: boolean;
  quota: number | null;
  used: number;
}): boolean {
  return (
    args.spaceCreatedAt < ENFORCEMENT_LAUNCH_DATE &&
    !args.hasEverSubscribed &&
    args.quota !== null &&
    args.used > args.quota
  );
}

/** A workspace degrades its extra Safes only when over-seat under plan rules. */
export function isOverSeat(args: {
  quota: number | null;
  used: number;
  grandfathered: boolean;
}): boolean {
  return (
    typeof args.quota === 'number' &&
    args.used > args.quota &&
    !args.grandfathered
  );
}

/**
 * The Safes that lose the org layer. Coverage defaults to the oldest Safes
 * (deterministic, computed at read, nothing stored); an admin's stored
 * selection takes precedence and is topped up oldest-first when it covers
 * fewer Safes than the quota allows.
 */
export function selectOverSeatSafeIds(args: {
  safeIdsOldestFirst: Array<number>;
  selectedSafeIds: Array<number>;
  quota: number;
}): Array<number> {
  const { safeIdsOldestFirst, selectedSafeIds, quota } = args;
  const current = new Set(safeIdsOldestFirst);
  const covered = new Set(
    selectedSafeIds.filter((id) => current.has(id)).slice(0, quota),
  );
  for (const id of safeIdsOldestFirst) {
    if (covered.size >= quota) {
      break;
    }
    covered.add(id);
  }
  return safeIdsOldestFirst.filter((id) => !covered.has(id));
}
