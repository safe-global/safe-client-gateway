// SPDX-License-Identifier: FSL-1.1-MIT

import type { Feature } from '#/modules/entitlements/domain/entities/feature.entity';
import type { FeatureGrant } from '#/modules/entitlements/domain/entities/feature-grant.entity';
import type { SpaceSubscription } from '#/modules/entitlements/domain/entities/space-subscription.entity';
import type { SubscriptionEntitlement } from '#/modules/entitlements/domain/entities/subscription-entitlement.entity';
import {
  DAY_IN_MS,
  isStockMeteredFeature,
} from '#/modules/entitlements/domain/entitlements.constants';

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
 * Whether the workspace's own entitlements decide its quotas yet. `startsAt`
 * is always a valid date: `configuration.ts` parses it once and throws on an
 * unparseable value, so this can never silently answer `true` for a typo.
 */
export function isEnforcementActive(args: {
  now: Date;
  startsAt: Date;
}): boolean {
  return args.now >= args.startsAt;
}

/**
 * Whether a workspace created at `createdAt` predates enforcement. The exact
 * complement of `isEnforcementActive`, so the boundary — a workspace created
 * exactly at `startsAt` is already enforced — is defined once.
 */
export function predatesEnforcement(args: {
  createdAt: Date;
  startsAt: Date;
}): boolean {
  return !isEnforcementActive({ now: args.createdAt, startsAt: args.startsAt });
}

/**
 * Whether an action consuming `delta` still fits the allowance. NULL quota is
 * unlimited, and an action consuming nothing fits while the workspace is not
 * over its limit: adding a chain to a Safe it already holds takes no new seat.
 */
export function fitsWithinQuota(args: {
  quota: number | null;
  used: number;
  delta: number;
}): boolean {
  const { quota, used, delta } = args;
  if (quota === null) {
    return true;
  }
  return used + delta <= quota;
}

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

/** Last day of a 0-based `month`; past 11 it rolls into the next year. */
function lastDayOfMonth(year: number, month: number): number {
  const firstOfNextMonth = Date.UTC(year, month + 1, 1);
  return new Date(firstOfNextMonth - DAY_IN_MS).getUTCDate();
}

/**
 * The same day `months` later, or that month's last day if it is shorter:
 * Jan 31 + 1 → Feb 28.
 */
function addMonthsToDate(date: Date, months: number): Date {
  const targetYear = date.getUTCFullYear();
  const targetMonth = date.getUTCMonth() + months;
  const targetDay = Math.min(
    date.getUTCDate(),
    lastDayOfMonth(targetYear, targetMonth),
  );
  const shiftedDate = new Date(date);
  shiftedDate.setUTCFullYear(targetYear, targetMonth, targetDay);
  return shiftedDate;
}

/** Whole months from `from` to `to`: a month counts once its day is reached. */
function completedMonthsBetween(from: Date, to: Date): number {
  const calendarMonths =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth());
  const reachedThisMonth = addMonthsToDate(from, calendarMonths) <= to;
  return reachedThisMonth ? calendarMonths : calendarMonths - 1;
}

/** The longest calendar month; a cycle up to this long is a monthly one. */
const LONGEST_MONTH_MS = 31 * DAY_IN_MS;

/** A usage window: the counter's period start and when it rolls over. */
type QuotaWindow = { start: Date; end: Date | null };

/**
 * The month of the billing cycle that contains `now`: the whole cycle when
 * monthly, else a calendar month of it (trial or annual).
 */
function currentMonthOfCycle(
  cycleStart: Date,
  cycleEnd: Date | null,
  now: Date,
): QuotaWindow {
  const isMonthlyCycle =
    cycleEnd === null ||
    cycleEnd.getTime() - cycleStart.getTime() <= LONGEST_MONTH_MS;
  // The month holding the cycle's last instant, one millisecond before its end.
  const lastMonth = isMonthlyCycle
    ? 0
    : completedMonthsBetween(cycleStart, new Date(cycleEnd.getTime() - 1));
  // Past the cycle end, the last month holds until the renewal webhook.
  const currentMonth = Math.min(
    Math.max(completedMonthsBetween(cycleStart, now), 0),
    lastMonth,
  );
  return {
    start: addMonthsToDate(cycleStart, currentMonth),
    end:
      currentMonth === lastMonth
        ? cycleEnd
        : addMonthsToDate(cycleStart, currentMonth + 1),
  };
}

/**
 * The current usage window of a feature. Paid workspaces count in monthly
 * windows of the billing cycle; free ones in `freePeriod`-day windows anchored
 * at the creation date, or in one open-ended window without a `freePeriod`.
 */
function quotaWindow(args: {
  feature: FeatureDefaults;
  spaceCreatedAt: Date;
  cycle: BillingCycle;
  now: Date;
}): QuotaWindow {
  const { feature, spaceCreatedAt, cycle, now } = args;
  if (cycle?.currentPeriodStart) {
    return currentMonthOfCycle(
      cycle.currentPeriodStart,
      cycle.currentPeriodEnd,
      now,
    );
  }
  if (feature.freePeriod !== null && feature.freePeriod > 0) {
    const anchor = spaceCreatedAt.getTime();
    const periodMs = feature.freePeriod * DAY_IN_MS;
    const elapsed = Math.max(0, now.getTime() - anchor);
    const start = anchor + Math.floor(elapsed / periodMs) * periodMs;
    return { start: new Date(start), end: new Date(start + periodMs) };
  }
  return { start: spaceCreatedAt, end: null };
}

/** Start of the current usage period of an event-metered feature. */
export function eventPeriodStart(args: {
  feature: FeatureDefaults;
  spaceCreatedAt: Date;
  cycle: BillingCycle;
  now: Date;
}): Date {
  return quotaWindow(args).start;
}

/** When the current quota window rolls over; NULL for stock-type features. */
export function resetsAt(args: {
  feature: FeatureDefaults;
  spaceCreatedAt: Date;
  cycle: BillingCycle;
  now: Date;
}): Date | null {
  return isStockMeteredFeature(args.feature) ? null : quotaWindow(args).end;
}

/**
 * Whether any grant was computed for a window that has since closed, which
 * makes the period its counter names the previous one: enforcing on it would
 * refuse against a count the API no longer reports, and would record usage
 * into a row nothing reads again. `resetsAt` is when that window rolls over.
 */
export function hasClosedWindow(
  grants: Record<string, FeatureGrant>,
  now: Date,
): boolean {
  return Object.values(grants).some(
    (grant) => grant.resetsAt !== null && grant.resetsAt <= now,
  );
}
