// SPDX-License-Identifier: FSL-1.1-MIT
import { subscriptionPlanBuilder } from '@/datasources/billing-api/entities/__tests__/plan.builder';
import { subscriptionBuilder } from '@/datasources/billing-api/entities/__tests__/subscription.builder';
import { webhookEventBuilder } from '@/modules/billing/domain/entities/__tests__/webhook-event.builder';
import type { WebhookEvent } from '@/modules/billing/domain/entities/webhook-event.entity';
import { FeatureType } from '@/modules/entitlements/domain/entities/feature.entity';
import {
  mapEventToSubscription,
  mapUpstreamSubscriptions,
} from '@/modules/entitlements/domain/subscription.mapper';

const featureTypeByKey: Map<string, FeatureType> = new Map([
  ['security_hub', FeatureType.Binary],
  ['safe_seats', FeatureType.Metered],
]);

// Asserted on, so they stay literal rather than faker-random.
const PERIOD_START = 1_700_000_000;
const PERIOD_END = 1_702_592_000;

describe('subscription.mapper', () => {
  let onWarning: (message: string) => void;
  let onError: (message: string) => void;

  beforeEach(() => {
    onWarning = vi.fn<(message: string) => void>();
    onError = vi.fn<(message: string) => void>();
  });

  describe('mapEventToSubscription', () => {
    // An active payload needs a feature package to count as a complete
    // snapshot, so it is part of the baseline every case starts from.
    function eventWith(
      data?: Partial<NonNullable<WebhookEvent['data']>>,
    ): WebhookEvent {
      const event = webhookEventBuilder().build();
      return {
        ...event,
        data: {
          ...event.data,
          metadata: { FEATURE_SAFE_SEATS: '10' },
          ...data,
        },
      };
    }

    it('maps a complete payload, taking the package from the metadata', () => {
      const event = eventWith({
        status: 'active',
        currentPeriodStart: PERIOD_START,
        currentPeriodEnd: PERIOD_END,
        metadata: {
          planCode: 'BUS-10-A',
          FEATURE_SAFE_SEATS: '10',
          FEATURE_SECURITY_HUB: 'true',
        },
      });

      expect(
        mapEventToSubscription({ event, featureTypeByKey, onWarning, onError }),
      ).toStrictEqual({
        upstreamSubscriptionId: event.data?.subscriptionId,
        status: 'active',
        planId: event.data?.planId,
        planName: null,
        planCode: 'BUS-10-A',
        currentPeriodStart: new Date(PERIOD_START * 1_000),
        currentPeriodEnd: new Date(PERIOD_END * 1_000),
        entitlements: [
          { featureKey: 'safe_seats', enabled: true, quota: 10, value: null },
          {
            featureKey: 'security_hub',
            enabled: true,
            quota: null,
            value: null,
          },
        ],
      });
      expect(onWarning).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    // Every payment link carries one, so its absence is an upstream anomaly.
    it('leaves the plan code null and logs an error when the metadata omits it', () => {
      const event = eventWith({ metadata: { FEATURE_SAFE_SEATS: '10' } });

      expect(
        mapEventToSubscription({ event, featureTypeByKey, onWarning, onError }),
      ).toMatchObject({ planCode: null });
      expect(onError).toHaveBeenCalledExactlyOnceWith(
        `Subscription ${event.data?.subscriptionId} carries no planCode in its metadata`,
      );
    });

    it('takes the plan name from the metadata', () => {
      const event = eventWith({
        metadata: { planName: 'Business', FEATURE_SAFE_SEATS: '10' },
      });

      expect(
        mapEventToSubscription({ event, featureTypeByKey, onWarning, onError }),
      ).toMatchObject({ planName: 'Business' });
    });

    // Anything short of a full snapshot sends the caller to the re-fetch
    // instead of writing nulls over stored state.
    it.each([
      ['no subscription id', { subscriptionId: null }],
      ['an empty subscription id', { subscriptionId: '' }],
      ['no plan', { planId: null }],
      ['an empty plan', { planId: '' }],
      ['no period start', { currentPeriodStart: null }],
      // An empty package would wipe the stored entitlements, so the
      // authoritative state decides whether it is really gone.
      ['no metadata on an active subscription', { metadata: null }],
      [
        'metadata carrying no feature entry',
        { metadata: { planName: 'Business' } },
      ],
    ])('returns null on %s', (_, data) => {
      const event = eventWith(data);

      expect(
        mapEventToSubscription({ event, featureTypeByKey, onWarning, onError }),
      ).toBeNull();
    });

    it('returns null and warns on a status the domain does not know', () => {
      const event = eventWith({ status: 'something.new' });

      expect(
        mapEventToSubscription({ event, featureTypeByKey, onWarning, onError }),
      ).toBeNull();
      expect(onWarning).toHaveBeenCalledTimes(1);
    });

    // Storing the period unset would contradict a payload that does carry one,
    // so the re-fetch decides instead.
    it('returns null and warns on an unrepresentable period end', () => {
      const event = eventWith({
        currentPeriodStart: PERIOD_START,
        currentPeriodEnd: Number.MAX_SAFE_INTEGER,
      });

      expect(
        mapEventToSubscription({ event, featureTypeByKey, onWarning, onError }),
      ).toBeNull();
      expect(onWarning).toHaveBeenCalledTimes(1);
    });

    it('maps an open-ended subscription carrying no period end', () => {
      const event = eventWith({
        currentPeriodStart: PERIOD_START,
        currentPeriodEnd: null,
      });

      expect(
        mapEventToSubscription({ event, featureTypeByKey, onWarning, onError }),
      ).toMatchObject({ currentPeriodEnd: null });
      expect(onWarning).not.toHaveBeenCalled();
    });

    it('attaches no package when the status is terminal', () => {
      const event = eventWith({
        status: 'canceled',
        metadata: { FEATURE_SAFE_SEATS: '10' },
      });

      expect(
        mapEventToSubscription({ event, featureTypeByKey, onWarning, onError }),
      ).toMatchObject({ status: 'canceled', entitlements: null });
    });
  });

  describe('mapUpstreamSubscriptions', () => {
    it('returns an empty batch for no subscriptions', () => {
      expect(
        mapUpstreamSubscriptions({
          subscriptions: [],
          featureTypeByKey,
          onWarning,
          onError,
        }),
      ).toStrictEqual([]);
    });

    it('maps every field and attaches the package to the active one', () => {
      const plan = subscriptionPlanBuilder().build();
      const active = subscriptionBuilder()
        .with('status', 'active')
        .with('plan', plan)
        .with('currentPeriodStart', PERIOD_START)
        .with('currentPeriodEnd', PERIOD_END)
        .with('metadata', { planCode: 'BUS-10-A', FEATURE_SAFE_SEATS: '10' })
        .build();
      const canceled = subscriptionBuilder()
        .with('status', 'canceled')
        .with('metadata', {
          planCode: 'BUS-99-A',
          FEATURE_SAFE_SEATS: '99',
        })
        .build();

      const result = mapUpstreamSubscriptions({
        subscriptions: [active, canceled],
        featureTypeByKey,
        onWarning,
        onError,
      });

      expect(result[0]).toStrictEqual({
        upstreamSubscriptionId: active.id,
        status: 'active',
        planId: plan.id,
        planName: plan.name,
        planCode: 'BUS-10-A',
        currentPeriodStart: new Date(PERIOD_START * 1_000),
        currentPeriodEnd: new Date(PERIOD_END * 1_000),
        entitlements: [
          { featureKey: 'safe_seats', enabled: true, quota: 10, value: null },
        ],
      });
      // Only the active subscription carries a package, so the canceled one's
      // own metadata is not turned into entitlements.
      expect(result[1]).toMatchObject({
        upstreamSubscriptionId: canceled.id,
        status: 'canceled',
        entitlements: null,
      });
      expect(onError).not.toHaveBeenCalled();
    });

    it('leaves the plan code null and logs an error when the metadata omits it', () => {
      const subscription = subscriptionBuilder()
        .with('status', 'canceled')
        .with('metadata', null)
        .build();

      expect(
        mapUpstreamSubscriptions({
          subscriptions: [subscription],
          featureTypeByKey,
          onWarning,
          onError,
        })[0],
      ).toMatchObject({ planCode: null });
      expect(onError).toHaveBeenCalledExactlyOnceWith(
        `Subscription ${subscription.id} carries no planCode in its metadata`,
      );
    });

    it('keeps the newest active subscription and demotes the surplus', () => {
      const older = subscriptionBuilder()
        .with('status', 'active')
        .with('createdAt', 1)
        .with('metadata', null)
        .build();
      const newer = subscriptionBuilder()
        .with('status', 'trialing')
        .with('createdAt', 2)
        .with('metadata', null)
        .build();

      const result = mapUpstreamSubscriptions({
        subscriptions: [older, newer],
        featureTypeByKey,
        onWarning,
        onError,
      });

      // The surplus one is demoted rather than dropped, so `materialize`
      // writes it and the "one active per space" index never sees two.
      expect(result).toStrictEqual([
        expect.objectContaining({
          upstreamSubscriptionId: older.id,
          status: 'canceled',
          entitlements: null,
        }),
        expect.objectContaining({
          upstreamSubscriptionId: newer.id,
          status: 'trialing',
          entitlements: [],
        }),
      ]);
      expect(onWarning).toHaveBeenCalledTimes(1);
    });

    it('breaks a createdAt tie on the subscription id', () => {
      const lower = subscriptionBuilder()
        .with('id', 'sub_a')
        .with('status', 'active')
        .with('createdAt', 1)
        .with('metadata', null)
        .build();
      const higher = subscriptionBuilder()
        .with('id', 'sub_b')
        .with('status', 'active')
        .with('createdAt', 1)
        .with('metadata', null)
        .build();

      const result = mapUpstreamSubscriptions({
        subscriptions: [lower, higher],
        featureTypeByKey,
        onWarning,
        onError,
      });

      expect(result).toStrictEqual([
        expect.objectContaining({
          upstreamSubscriptionId: 'sub_a',
          status: 'canceled',
        }),
        expect.objectContaining({
          upstreamSubscriptionId: 'sub_b',
          status: 'active',
        }),
      ]);
    });

    it('leaves the plan name null when upstream omits it', () => {
      const subscription = subscriptionBuilder()
        .with('status', 'canceled')
        .with('plan', subscriptionPlanBuilder().with('name', null).build())
        .with('metadata', null)
        .build();

      expect(
        mapUpstreamSubscriptions({
          subscriptions: [subscription],
          featureTypeByKey,
          onWarning,
          onError,
        })[0],
      ).toMatchObject({ planName: null });
    });

    // The authoritative state is all there is here, so it is stored with the
    // period unset rather than skipped — but not without a trace.
    it('warns and leaves an unrepresentable period unset', () => {
      const subscription = subscriptionBuilder()
        .with('status', 'canceled')
        .with('currentPeriodStart', Number.MAX_SAFE_INTEGER)
        .with('currentPeriodEnd', null)
        .with('metadata', null)
        .build();

      expect(
        mapUpstreamSubscriptions({
          subscriptions: [subscription],
          featureTypeByKey,
          onWarning,
          onError,
        })[0],
      ).toMatchObject({ currentPeriodStart: null, currentPeriodEnd: null });
      expect(onWarning).toHaveBeenCalledTimes(1);
    });

    it('does not warn when upstream simply carries no period', () => {
      const subscription = subscriptionBuilder()
        .with('status', 'canceled')
        .with('currentPeriodStart', null)
        .with('currentPeriodEnd', null)
        .with('metadata', null)
        .build();

      expect(
        mapUpstreamSubscriptions({
          subscriptions: [subscription],
          featureTypeByKey,
          onWarning,
          onError,
        })[0],
      ).toMatchObject({ currentPeriodStart: null, currentPeriodEnd: null });
      expect(onWarning).not.toHaveBeenCalled();
    });
  });
});
