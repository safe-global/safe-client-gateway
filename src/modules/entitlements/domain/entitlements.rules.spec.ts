// SPDX-License-Identifier: FSL-1.1-MIT

import { DAY_IN_MS } from '@/modules/entitlements/domain/entitlements.constants';
import type { FeatureDefaults } from '@/modules/entitlements/domain/entitlements.rules';
import {
  effectiveEntitlement,
  eventPeriodStart,
  isOverLimit,
  resetsAt,
} from '@/modules/entitlements/domain/entitlements.rules';

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

  describe('isOverLimit', () => {
    it('is true once usage passed the quota', () => {
      expect(isOverLimit({ quota: 2, used: 3 })).toBe(true);
    });

    it('is false right at the quota, which is still within it', () => {
      expect(isOverLimit({ quota: 5, used: 5 })).toBe(false);
    });

    it('is false for an unlimited quota, whatever the usage', () => {
      expect(isOverLimit({ quota: null, used: 9_000 })).toBe(false);
    });

    it('is false for a feature that carries no usage at all', () => {
      expect(isOverLimit({})).toBe(false);
      expect(isOverLimit({ quota: 0, used: undefined })).toBe(false);
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
});
