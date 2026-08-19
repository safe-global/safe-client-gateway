// SPDX-License-Identifier: FSL-1.1-MIT

import type { Feature } from '@/modules/entitlements/domain/entities/feature.entity';
import type { ResolvedEntitlement } from '@/modules/entitlements/domain/entities/resolved-entitlements.entity';
import type { SpaceSubscription } from '@/modules/entitlements/domain/entities/space-subscription.entity';
import type { SubscriptionEntitlement } from '@/modules/entitlements/domain/entities/subscription-entitlement.entity';
import {
  DAY_IN_MS,
  isStockMeteredFeature,
} from '@/modules/entitlements/domain/entitlements.constants';

/**
 * The Free-tier fallback and the usage window, derived here so the repository
 * stays a data-access layer.
 */

/** Only the catalog fields the rules need, so entity classes stay out. */
export type FeatureDefaults = Pick<
  Feature,
  'key' | 'freeEnabled' | 'freeQuota' | 'freeValue' | 'freePeriod'
>;

/** The purchased row for a feature, when the workspace has one. */
type PurchasedEntitlement = Pick<
  SubscriptionEntitlement,
  'enabled' | 'quota' | 'value'
>;

/** The active subscription's billing cycle, or null on the Free plan. */
type BillingCycle = Pick<
  SpaceSubscription,
  'currentPeriodStart' | 'currentPeriodEnd'
> | null;

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

/**
 * Whether usage has passed the quota the plan grants. `used > quota` is a legal
 * state — the quota is never inflated to match usage — so this is where it gets
 * named, next to the two fields it is read from: the enforcement layer locks on
 * it, and clients are spared re-deriving a rule whose unlimited case (a null
 * quota, which no usage can pass) is easy to get wrong.
 */
export function isOverLimit(
  entitlement: Pick<ResolvedEntitlement, 'quota' | 'used'>,
): boolean {
  return (
    entitlement.quota != null &&
    entitlement.used != null &&
    entitlement.used > entitlement.quota
  );
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
