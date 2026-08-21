// SPDX-License-Identifier: FSL-1.1-MIT

import type { Feature } from '@/modules/entitlements/domain/entities/feature.entity';
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

/** What a feature grants the workspace once the plan is applied. */
type EffectiveEntitlement = {
  enabled: boolean;
  quota: number | null;
  value: string | null;
};

/** The active subscription's billing cycle, or null on the Free plan. */
type BillingCycle = Pick<
  SpaceSubscription,
  'currentPeriodStart' | 'currentPeriodEnd'
> | null;

/**
 * The effective entitlement of one feature: the purchased package wins,
 * otherwise the catalog's defaults. Both branches produce the same shape, so
 * consumers never know which one served them.
 *
 * `enabled` says only whether the feature is active, and the purchased row
 * carries that answer: materialization writes it from the upstream metadata, so
 * a package that explicitly switches a feature off is honoured here.
 */
export function effectiveEntitlement(args: {
  feature: FeatureDefaults;
  purchased: PurchasedEntitlement | undefined;
}): EffectiveEntitlement {
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
  if (feature.freePeriod !== null && feature.freePeriod > 0) {
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
  if (isStockMeteredFeature(feature)) {
    return null;
  }
  if (cycle?.currentPeriodStart) {
    return cycle.currentPeriodEnd;
  }
  if (feature.freePeriod !== null && feature.freePeriod > 0) {
    return new Date(
      eventPeriodStart(args).getTime() + feature.freePeriod * DAY_IN_MS,
    );
  }
  return null;
}
