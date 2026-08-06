// SPDX-License-Identifier: FSL-1.1-MIT
import { ENFORCEMENT_LAUNCH_DATE } from '@/modules/entitlements/domain/entitlements.constants';
import type { FeatureDefaults } from '@/modules/entitlements/domain/entitlements.rules';
import {
  effectiveEntitlement,
  enforceableQuota,
  eventPeriodStart,
  isGrandfathered,
  isOverSeat,
  resetsAt,
  selectOverSeatSafeIds,
} from '@/modules/entitlements/domain/entitlements.rules';

const DAY_IN_MS = 24 * 60 * 60 * 1_000;
const PRE_LAUNCH = new Date(ENFORCEMENT_LAUNCH_DATE.getTime() - DAY_IN_MS);
const POST_LAUNCH = new Date(ENFORCEMENT_LAUNCH_DATE.getTime() + DAY_IN_MS);

function feature(overrides?: Partial<FeatureDefaults>): FeatureDefaults {
  return {
    key: 'sponsored_transactions',
    freeEnabled: true,
    freeQuota: 10,
    freeValue: null,
    freePeriod: null,
    ...overrides,
  };
}

describe('entitlements rules', () => {
  describe('effectiveEntitlement', () => {
    it('falls back to the catalog defaults with no purchased package', () => {
      expect(
        effectiveEntitlement({
          feature: feature({ freeEnabled: true, freeQuota: 2, freeValue: 'x' }),
          purchased: undefined,
        }),
      ).toStrictEqual({ enabled: true, quota: 2, value: 'x' });
    });

    it('lets the purchased package win, including a null (unlimited) quota', () => {
      expect(
        effectiveEntitlement({
          feature: feature({ freeQuota: 2 }),
          purchased: { enabled: true, quota: null, value: null },
        }),
      ).toStrictEqual({ enabled: true, quota: null, value: null });
    });
  });

  describe('enforceableQuota', () => {
    it('admits no usage at all for a disabled feature', () => {
      expect(enforceableQuota({ enabled: false, quota: 10, value: null })).toBe(
        0,
      );
      // Even when the plan says unlimited.
      expect(
        enforceableQuota({ enabled: false, quota: null, value: null }),
      ).toBe(0);
    });

    it('keeps null (unlimited) for an enabled feature', () => {
      expect(
        enforceableQuota({ enabled: true, quota: null, value: null }),
      ).toBeNull();
    });
  });

  describe('eventPeriodStart', () => {
    const spaceCreatedAt = new Date('2026-01-01T00:00:00Z');

    it('anchors on the billing cycle when subscribed', () => {
      const currentPeriodStart = new Date('2026-07-01T00:00:00Z');

      expect(
        eventPeriodStart({
          feature: feature({ freePeriod: 30 }),
          spaceCreatedAt,
          cycle: { currentPeriodStart, currentPeriodEnd: null },
          now: new Date('2026-07-15T00:00:00Z'),
        }),
      ).toStrictEqual(currentPeriodStart);
    });

    it('buckets Free usage in whole windows anchored at the creation date', () => {
      // 70 days in with a 30-day window → third bucket, starting on day 60.
      expect(
        eventPeriodStart({
          feature: feature({ freePeriod: 30 }),
          spaceCreatedAt,
          cycle: null,
          now: new Date(spaceCreatedAt.getTime() + 70 * DAY_IN_MS),
        }),
      ).toStrictEqual(new Date(spaceCreatedAt.getTime() + 60 * DAY_IN_MS));
    });

    it('treats the whole lifetime as one bucket without a window', () => {
      expect(
        eventPeriodStart({
          feature: feature({ freePeriod: null }),
          spaceCreatedAt,
          cycle: null,
          now: new Date('2026-12-31T00:00:00Z'),
        }),
      ).toStrictEqual(spaceCreatedAt);
    });
  });

  describe('resetsAt', () => {
    const spaceCreatedAt = new Date('2026-01-01T00:00:00Z');

    it('is null for stock-metered features, which have no reset window', () => {
      expect(
        resetsAt({
          feature: feature({ key: 'safe_seats', freePeriod: 30 }),
          spaceCreatedAt,
          cycle: null,
          now: new Date(),
        }),
      ).toBeNull();
    });

    it('is the cycle end when subscribed', () => {
      const currentPeriodEnd = new Date('2026-08-01T00:00:00Z');

      expect(
        resetsAt({
          feature: feature({ freePeriod: 30 }),
          spaceCreatedAt,
          cycle: {
            currentPeriodStart: new Date('2026-07-01T00:00:00Z'),
            currentPeriodEnd,
          },
          now: new Date('2026-07-15T00:00:00Z'),
        }),
      ).toStrictEqual(currentPeriodEnd);
    });

    it('is one window past the current Free bucket', () => {
      expect(
        resetsAt({
          feature: feature({ freePeriod: 30 }),
          spaceCreatedAt,
          cycle: null,
          now: new Date(spaceCreatedAt.getTime() + 70 * DAY_IN_MS),
        }),
      ).toStrictEqual(new Date(spaceCreatedAt.getTime() + 90 * DAY_IN_MS));
    });

    it('never resets without a window and without a subscription', () => {
      expect(
        resetsAt({
          feature: feature({ freePeriod: null }),
          spaceCreatedAt,
          cycle: null,
          now: new Date(),
        }),
      ).toBeNull();
    });
  });

  describe('isGrandfathered', () => {
    const overQuota = { quota: 2, used: 3 };

    it('protects a pre-launch, never-subscribed, over-quota workspace', () => {
      expect(
        isGrandfathered({
          spaceCreatedAt: PRE_LAUNCH,
          hasEverSubscribed: false,
          ...overQuota,
        }),
      ).toBe(true);
    });

    it('requires all three conditions', () => {
      // Created after enforcement went live.
      expect(
        isGrandfathered({
          spaceCreatedAt: POST_LAUNCH,
          hasEverSubscribed: false,
          ...overQuota,
        }),
      ).toBe(false);
      // Has purchased at some point — the protection ends permanently.
      expect(
        isGrandfathered({
          spaceCreatedAt: PRE_LAUNCH,
          hasEverSubscribed: true,
          ...overQuota,
        }),
      ).toBe(false);
      // Within quota, so there is nothing to protect.
      expect(
        isGrandfathered({
          spaceCreatedAt: PRE_LAUNCH,
          hasEverSubscribed: false,
          quota: 2,
          used: 2,
        }),
      ).toBe(false);
    });

    it('never applies to an unlimited quota', () => {
      expect(
        isGrandfathered({
          spaceCreatedAt: PRE_LAUNCH,
          hasEverSubscribed: false,
          quota: null,
          used: 1_000,
        }),
      ).toBe(false);
    });
  });

  describe('isOverSeat', () => {
    it('degrades only when over quota and not grandfathered', () => {
      expect(isOverSeat({ quota: 2, used: 3, grandfathered: false })).toBe(
        true,
      );
      expect(isOverSeat({ quota: 2, used: 3, grandfathered: true })).toBe(
        false,
      );
      expect(isOverSeat({ quota: 2, used: 2, grandfathered: false })).toBe(
        false,
      );
      expect(isOverSeat({ quota: null, used: 99, grandfathered: false })).toBe(
        false,
      );
    });
  });

  describe('selectOverSeatSafeIds', () => {
    it('covers the oldest Safes by default', () => {
      expect(
        selectOverSeatSafeIds({
          safeIdsOldestFirst: [1, 2, 3, 4],
          selectedSafeIds: [],
          quota: 2,
        }),
      ).toStrictEqual([3, 4]);
    });

    it("honors the admin's selection", () => {
      expect(
        selectOverSeatSafeIds({
          safeIdsOldestFirst: [1, 2, 3, 4],
          selectedSafeIds: [3, 4],
          quota: 2,
        }),
      ).toStrictEqual([1, 2]);
    });

    it('tops a partial selection up oldest-first', () => {
      expect(
        selectOverSeatSafeIds({
          safeIdsOldestFirst: [1, 2, 3, 4],
          selectedSafeIds: [4],
          quota: 2,
        }),
      ).toStrictEqual([2, 3]);
    });

    it('ignores selected Safes that no longer belong to the workspace', () => {
      expect(
        selectOverSeatSafeIds({
          safeIdsOldestFirst: [1, 2, 3],
          selectedSafeIds: [99, 3],
          quota: 1,
        }),
      ).toStrictEqual([1, 2]);
    });

    it('caps coverage at the quota even if more Safes were selected', () => {
      expect(
        selectOverSeatSafeIds({
          safeIdsOldestFirst: [1, 2, 3, 4],
          selectedSafeIds: [2, 3, 4],
          quota: 1,
        }),
      ).toStrictEqual([1, 3, 4]);
    });

    it('degrades nothing when everything fits', () => {
      expect(
        selectOverSeatSafeIds({
          safeIdsOldestFirst: [1, 2],
          selectedSafeIds: [],
          quota: 5,
        }),
      ).toStrictEqual([]);
    });
  });
});
