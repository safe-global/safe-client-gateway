// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { featureBuilder } from '#/modules/entitlements/domain/entities/__tests__/feature.builder';
import { DAY_IN_MS } from '#/modules/entitlements/domain/entitlements.constants';
import type { FeatureDefaults } from '#/modules/entitlements/domain/entitlements.rules';
import {
  effectiveEntitlement,
  eventPeriodStart,
  fitsWithinQuota,
  isEnforcementActive,
  predatesEnforcement,
  resetsAt,
} from '#/modules/entitlements/domain/entitlements.rules';

function feature(overrides?: Partial<FeatureDefaults>): FeatureDefaults {
  return { ...featureBuilder().build(), ...overrides };
}

describe('entitlements rules', () => {
  describe('isEnforcementActive', () => {
    const startsAt = faker.date.recent();

    it.each([
      ['before the date', new Date(startsAt.getTime() - 1), false],
      ['on the date', new Date(startsAt.getTime()), true],
      ['after the date', new Date(startsAt.getTime() + 1), true],
    ])('is %s', (_label, now, expected) => {
      expect(isEnforcementActive({ now, startsAt })).toBe(expected);
    });
  });

  describe('predatesEnforcement', () => {
    const startsAt = faker.date.recent();

    it.each([
      ['created before the date', new Date(startsAt.getTime() - 1), true],
      ['created on the date', new Date(startsAt.getTime()), false],
      ['created after the date', new Date(startsAt.getTime() + 1), false],
    ])('is %s', (_label, createdAt, expected) => {
      expect(predatesEnforcement({ createdAt, startsAt })).toBe(expected);
    });
  });

  describe('fitsWithinQuota', () => {
    it('never blocks on an unlimited quota', () => {
      expect(
        fitsWithinQuota({
          quota: null,
          used: faker.number.int({ min: 1, max: 1_000 }),
          delta: faker.number.int({ min: 1, max: 100 }),
        }),
      ).toBe(true);
    });

    it.each([
      ['room for the batch', 8, 2, true],
      ['exactly filling the quota', 9, 1, true],
      ['the batch overshooting', 8, 3, false],
      ['at the limit and consuming nothing', 10, 0, true],
      ['at the limit and consuming one', 10, 1, false],
      ['over the limit and consuming nothing', 12, 0, false],
      ['over the limit and consuming one', 12, 1, false],
    ])('is %s', (_label, used, delta, expected) => {
      expect(fitsWithinQuota({ quota: 10, used, delta })).toBe(expected);
    });

    it('refuses a spend on a zero quota', () => {
      expect(fitsWithinQuota({ quota: 0, used: 0, delta: 1 })).toBe(false);
    });

    it('admits a zero-cost action on a zero quota', () => {
      expect(fitsWithinQuota({ quota: 0, used: 0, delta: 0 })).toBe(true);
    });
  });

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

    it('enables a purchased feature the catalog disables', () => {
      expect(
        effectiveEntitlement({
          feature: feature({ freeEnabled: false, freeQuota: 0 }),
          purchased: { enabled: true, quota: 20, value: null },
        }),
      ).toStrictEqual({ enabled: true, quota: 20, value: null });
    });

    it('honours a purchased row that switches the feature off', () => {
      expect(
        effectiveEntitlement({
          feature: feature({ freeEnabled: true }),
          purchased: { enabled: false, quota: null, value: null },
        }),
      ).toStrictEqual({ enabled: false, quota: null, value: null });
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

    it('starts the quota period with a monthly plan, even one from Feb 28 to Mar 31', () => {
      const currentPeriodStart = new Date('2026-02-28T00:00:00Z');

      expect(
        eventPeriodStart({
          feature: feature({ freePeriod: 30 }),
          spaceCreatedAt,
          cycle: {
            currentPeriodStart,
            currentPeriodEnd: new Date('2026-03-31T00:00:00Z'),
          },
          now: new Date('2026-03-30T00:00:00Z'),
        }),
      ).toStrictEqual(currentPeriodStart);
    });

    it.each([
      ['the first month', '2026-01-20T00:00:00Z', '2026-01-15T10:30:00Z'],
      ['a later month', '2026-03-20T00:00:00Z', '2026-03-15T10:30:00Z'],
      [
        'exactly when a new month starts',
        '2026-02-15T10:30:00Z',
        '2026-02-15T10:30:00Z',
      ],
      [
        'one millisecond before a new month starts',
        '2026-02-15T10:29:59.999Z',
        '2026-01-15T10:30:00Z',
      ],
      ['the last month', '2026-12-20T00:00:00Z', '2026-12-15T10:30:00Z'],
      [
        'after the plan ended, before the renewal arrives',
        '2027-02-20T00:00:00Z',
        '2026-12-15T10:30:00Z',
      ],
    ])(
      'starts a new quota period every month on a yearly plan: %s',
      (_label, now, expected) => {
        expect(
          eventPeriodStart({
            feature: feature({ freePeriod: 30 }),
            spaceCreatedAt,
            cycle: {
              currentPeriodStart: new Date('2026-01-15T10:30:00Z'),
              currentPeriodEnd: new Date('2027-01-15T10:30:00Z'),
            },
            now: new Date(now),
          }),
        ).toStrictEqual(new Date(expected));
      },
    );

    it.each([
      [
        'still in January',
        '2027-01-31T00:00:00Z',
        '2027-02-15T00:00:00Z',
        '2027-01-31T00:00:00Z',
      ],
      [
        'in February',
        '2027-01-31T00:00:00Z',
        '2027-03-01T00:00:00Z',
        '2027-02-28T00:00:00Z',
      ],
      [
        'in February of a leap year',
        '2028-01-31T00:00:00Z',
        '2028-03-01T00:00:00Z',
        '2028-02-29T00:00:00Z',
      ],
      [
        'in March',
        '2027-01-31T00:00:00Z',
        '2027-04-01T00:00:00Z',
        '2027-03-31T00:00:00Z',
      ],
    ])(
      'starts the quota period on the last day of a shorter month when the plan starts on the 31st: %s',
      (_label, start, now, expected) => {
        const currentPeriodStart = new Date(start);
        const currentPeriodEnd = new Date(currentPeriodStart);
        currentPeriodEnd.setUTCFullYear(currentPeriodEnd.getUTCFullYear() + 1);

        expect(
          eventPeriodStart({
            feature: feature({ freePeriod: 30 }),
            spaceCreatedAt,
            cycle: { currentPeriodStart, currentPeriodEnd },
            now: new Date(now),
          }),
        ).toStrictEqual(new Date(expected));
      },
    );

    it.each([
      ['the first month', '2026-10-15T00:00:00Z', '2026-10-01T09:00:00Z'],
      ['the second month', '2026-11-15T00:00:00Z', '2026-11-01T09:00:00Z'],
    ])(
      'starts a new quota period every month on a 60-day trial: %s',
      (_label, now, expected) => {
        expect(
          eventPeriodStart({
            feature: feature({ freePeriod: 30 }),
            spaceCreatedAt,
            cycle: {
              currentPeriodStart: new Date('2026-10-01T09:00:00Z'),
              currentPeriodEnd: new Date('2026-11-30T09:00:00Z'),
            },
            now: new Date(now),
          }),
        ).toStrictEqual(new Date(expected));
      },
    );

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

    it('resets the quota when a monthly plan ends, even one from Feb 28 to Mar 31', () => {
      const currentPeriodEnd = new Date('2026-03-31T00:00:00Z');

      expect(
        resetsAt({
          feature: feature({ freePeriod: 30 }),
          spaceCreatedAt,
          cycle: {
            currentPeriodStart: new Date('2026-02-28T00:00:00Z'),
            currentPeriodEnd,
          },
          now: new Date('2026-03-30T00:00:00Z'),
        }),
      ).toStrictEqual(currentPeriodEnd);
    });

    it.each([
      ['the first month', '2026-01-20T00:00:00Z', '2026-02-15T10:30:00Z'],
      [
        'exactly when a new month starts',
        '2026-02-15T10:30:00Z',
        '2026-03-15T10:30:00Z',
      ],
      ['the last month', '2026-12-20T00:00:00Z', '2027-01-15T10:30:00Z'],
      [
        'after the plan ended, before the renewal arrives',
        '2027-02-20T00:00:00Z',
        '2027-01-15T10:30:00Z',
      ],
    ])(
      'resets the quota every month on a yearly plan: %s',
      (_label, now, expected) => {
        expect(
          resetsAt({
            feature: feature({ freePeriod: 30 }),
            spaceCreatedAt,
            cycle: {
              currentPeriodStart: new Date('2026-01-15T10:30:00Z'),
              currentPeriodEnd: new Date('2027-01-15T10:30:00Z'),
            },
            now: new Date(now),
          }),
        ).toStrictEqual(new Date(expected));
      },
    );

    it.each([
      ['the first month', '2026-10-15T00:00:00Z', '2026-11-01T09:00:00Z'],
      ['the second month', '2026-11-15T00:00:00Z', '2026-11-30T09:00:00Z'],
    ])(
      'resets the quota every month on a 60-day trial: %s',
      (_label, now, expected) => {
        expect(
          resetsAt({
            feature: feature({ freePeriod: 30 }),
            spaceCreatedAt,
            cycle: {
              currentPeriodStart: new Date('2026-10-01T09:00:00Z'),
              currentPeriodEnd: new Date('2026-11-30T09:00:00Z'),
            },
            now: new Date(now),
          }),
        ).toStrictEqual(new Date(expected));
      },
    );

    it('resets the quota on the last day of February when the plan starts on the 31st', () => {
      expect(
        resetsAt({
          feature: feature({ freePeriod: 30 }),
          spaceCreatedAt,
          cycle: {
            currentPeriodStart: new Date('2027-01-31T00:00:00Z'),
            currentPeriodEnd: new Date('2028-01-31T00:00:00Z'),
          },
          now: new Date('2027-02-15T00:00:00Z'),
        }),
      ).toStrictEqual(new Date('2027-02-28T00:00:00Z'));
    });

    it('never resets the quota when the plan has no end date', () => {
      expect(
        resetsAt({
          feature: feature({ freePeriod: 30 }),
          spaceCreatedAt,
          cycle: {
            currentPeriodStart: new Date('2026-07-01T00:00:00Z'),
            currentPeriodEnd: null,
          },
          now: new Date('2026-07-15T00:00:00Z'),
        }),
      ).toBeNull();
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
