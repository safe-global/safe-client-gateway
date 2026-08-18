// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { MockedObject } from 'vitest';
import { subscriptionBuilder } from '@/datasources/billing-api/entities/__tests__/subscription.builder';
import { CacheRouter } from '@/datasources/cache/cache.router';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import { toSecondsTimestamp } from '@/domain/common/utils/time';
import type { IBillingApi } from '@/domain/interfaces/billing-api.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import {
  webhookEventBuilder,
  webhookEventCustomerBuilder,
} from '@/modules/billing/domain/entities/__tests__/webhook-event.builder';
import type { WebhookEvent } from '@/modules/billing/domain/entities/webhook-event.entity';
import { WALLET_WEB_CUSTOMER_GROUP } from '@/modules/billing/domain/entities/webhook-event.entity';
import { featureBuilder } from '@/modules/entitlements/domain/entities/__tests__/feature.builder';
import type { Feature } from '@/modules/entitlements/domain/entities/feature.entity';
import { FeatureType } from '@/modules/entitlements/domain/entities/feature.entity';
import type { IFeaturesRepository } from '@/modules/entitlements/domain/features.repository.interface';
import type { ISubscriptionsRepository } from '@/modules/entitlements/domain/subscriptions.repository.interface';
import { EntitlementsService } from '@/modules/entitlements/routes/entitlements.service';
import { SubscriptionSyncService } from '@/modules/entitlements/routes/subscription-sync.service';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { fakeUuid } from '@/validation/entities/schemas/__tests__/uuid.builder';

const FEATURES: Array<Feature> = [
  featureBuilder()
    .with('key', 'safe_seats')
    .with('type', FeatureType.Metered)
    .build(),
];

describe('SubscriptionSyncService', () => {
  const spaceId = faker.number.int({ min: 1, max: 100_000 });
  const spaceUuid = fakeUuid();

  let billingApi: MockedObject<IBillingApi>;
  let entitlementsService: MockedObject<
    Pick<
      EntitlementsService,
      'materializeFromEvent' | 'materializeAuthoritative'
    >
  >;
  let spacesRepository: MockedObject<Pick<ISpacesRepository, 'findIdByUuid'>>;
  let featuresRepository: MockedObject<IFeaturesRepository>;
  let subscriptionsRepository: MockedObject<
    Pick<ISubscriptionsRepository, 'getLastEventAt'>
  >;
  let cacheService: MockedObject<ICacheService>;
  let loggingService: MockedObject<ILoggingService>;
  let target: SubscriptionSyncService;

  // `handleWebhook` no longer parses the raw wire payload itself (that now
  // happens once, at the controller's ValidationPipe) — this helper builds
  // the already-validated `WebhookEvent` shape via the shared builders, so
  // `upstreamCustomerId` is dashed here, not raw.
  function webhookEvent(overrides?: {
    type?: string;
    created?: number;
    upstreamCustomerId?: string | null;
    customerGroup?: string;
    data?: Partial<NonNullable<WebhookEvent['data']>>;
  }): WebhookEvent {
    let customerBuilder = webhookEventCustomerBuilder().with(
      'upstreamCustomerId',
      overrides?.upstreamCustomerId === undefined
        ? spaceUuid
        : overrides.upstreamCustomerId,
    );
    if (overrides?.customerGroup !== undefined) {
      customerBuilder = customerBuilder.with(
        'customerGroup',
        overrides.customerGroup,
      );
    }

    let builder = webhookEventBuilder();
    if (overrides?.type !== undefined) {
      builder = builder.with('type', overrides.type);
    }
    if (overrides?.created !== undefined) {
      builder = builder.with('created', overrides.created);
    }
    const event = builder.build();

    return {
      ...event,
      data: {
        ...event.data,
        customer: customerBuilder.build(),
        // An active payload without a package is not a complete snapshot, so
        // the baseline carries one to exercise the direct-payload path.
        metadata: { FEATURE_SAFE_SEATS: '10' },
        ...overrides?.data,
      },
    };
  }

  // An event whose payload is not a complete subscription snapshot, so the
  // service falls back to re-fetching the authoritative state.
  function partialWebhookEvent(): WebhookEvent {
    return webhookEvent({ data: { planId: null } });
  }

  beforeEach(() => {
    vi.resetAllMocks();

    billingApi = {
      getSubscriptionsByCustomerId: vi.fn(),
    } as unknown as MockedObject<IBillingApi>;
    entitlementsService = {
      materializeFromEvent: vi.fn().mockResolvedValue(true),
      materializeAuthoritative: vi.fn().mockResolvedValue(true),
    };
    spacesRepository = {
      findIdByUuid: vi.fn().mockResolvedValue(spaceId),
    };
    featuresRepository = {
      getFeatures: vi.fn().mockResolvedValue(FEATURES),
    };
    subscriptionsRepository = {
      getLastEventAt: vi.fn().mockResolvedValue(null),
    };
    cacheService = {
      deleteByKey: vi.fn(),
    } as unknown as MockedObject<ICacheService>;
    loggingService = {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    } as MockedObject<ILoggingService>;

    target = new SubscriptionSyncService(
      billingApi,
      entitlementsService as unknown as EntitlementsService,
      spacesRepository as unknown as ISpacesRepository,
      featuresRepository,
      subscriptionsRepository as unknown as ISubscriptionsRepository,
      cacheService,
      loggingService,
    );
  });

  it('falls back to re-fetching upstream state when the event carries no plan', async () => {
    const active = subscriptionBuilder()
      .with('status', 'active')
      .with('createdAt', 2)
      .with('currentPeriodStart', 1_700_000_000)
      .with('currentPeriodEnd', 1_702_592_000)
      .with('metadata', { FEATURE_SAFE_SEATS: '10' })
      .build();
    const canceled = subscriptionBuilder()
      .with('status', 'canceled')
      .with('createdAt', 1)
      .build();
    billingApi.getSubscriptionsByCustomerId.mockResolvedValue([
      active,
      canceled,
    ]);

    await target.handleWebhook(partialWebhookEvent());

    // The billing-api Redis cache is busted before the re-fetch.
    expect(cacheService.deleteByKey).toHaveBeenCalledWith(
      CacheRouter.getBillingSubscriptionsCacheDir({
        upstreamCustomerId: spaceUuid,
        status: 'all',
      }).key,
    );
    expect(billingApi.getSubscriptionsByCustomerId).toHaveBeenCalledWith({
      upstreamCustomerId: spaceUuid,
      status: 'all',
    });
    expect(
      entitlementsService.materializeAuthoritative,
    ).toHaveBeenCalledExactlyOnceWith({
      spaceId,
      triggerEventAt: expect.any(Date),
      // The mark as it stood before the fetch went out: the write is abandoned
      // if it has moved by the time the lock is held.
      observedEventAt: null,
      subscriptions: [
        expect.objectContaining({
          upstreamSubscriptionId: active.id,
          status: 'active',
          planId: active.plan.id,
          currentPeriodStart: new Date(1_700_000_000_000),
          currentPeriodEnd: new Date(1_702_592_000_000),
          entitlements: [
            {
              featureKey: 'safe_seats',
              enabled: true,
              quota: 10,
              value: null,
            },
          ],
        }),
        expect.objectContaining({
          upstreamSubscriptionId: canceled.id,
          status: 'canceled',
          entitlements: null,
        }),
      ],
    });
  });

  it('is idempotent: processing the same event twice materializes the same state', async () => {
    const event = webhookEvent({ type: 'customer.subscription.updated' });

    await target.handleWebhook(event);
    await target.handleWebhook(event);

    const expected = {
      spaceId,
      eventAt: expect.any(Date),
      subscription: expect.objectContaining({
        upstreamSubscriptionId: event.data?.subscriptionId,
        status: 'active',
        planId: event.data?.planId,
      }),
    };
    expect(entitlementsService.materializeFromEvent).toHaveBeenCalledTimes(2);
    expect(entitlementsService.materializeFromEvent).toHaveBeenNthCalledWith(
      1,
      expected,
    );
    expect(entitlementsService.materializeFromEvent).toHaveBeenNthCalledWith(
      2,
      expected,
    );
  });

  it.each([
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'customer.subscription.paused',
  ])('materializes the %s event payload', async (type) => {
    await target.handleWebhook(webhookEvent({ type }));

    expect(entitlementsService.materializeFromEvent).toHaveBeenCalledTimes(1);
    expect(billingApi.getSubscriptionsByCustomerId).not.toHaveBeenCalled();
  });

  // These describe a session or an invoice, never a subscription: acting on
  // them could only re-fetch, overwriting the snapshot a
  // `customer.subscription.*` event already materialized.
  it.each([
    'checkout.session.completed',
    'invoice.payment_succeeded',
    'invoice.payment_failed',
  ])('acks and ignores %s without re-fetching', async (type) => {
    await target.handleWebhook(webhookEvent({ type }));

    expect(entitlementsService.materializeFromEvent).not.toHaveBeenCalled();
    expect(entitlementsService.materializeAuthoritative).not.toHaveBeenCalled();
    expect(billingApi.getSubscriptionsByCustomerId).not.toHaveBeenCalled();
    expect(loggingService.info).toHaveBeenCalled();
  });

  it('invalidates the payment links cache and skips materialization for payment_link events', async () => {
    await target.handleWebhook(webhookEvent({ type: 'payment_link.created' }));

    expect(cacheService.deleteByKey).toHaveBeenCalledExactlyOnceWith(
      CacheRouter.getBillingPaymentLinksCacheDir().key,
    );
    expect(billingApi.getSubscriptionsByCustomerId).not.toHaveBeenCalled();
    expect(entitlementsService.materializeFromEvent).not.toHaveBeenCalled();
    expect(entitlementsService.materializeAuthoritative).not.toHaveBeenCalled();
  });

  it('acks and ignores unknown event types', async () => {
    await target.handleWebhook(webhookEvent({ type: 'something.new' }));

    expect(entitlementsService.materializeFromEvent).not.toHaveBeenCalled();
    expect(entitlementsService.materializeAuthoritative).not.toHaveBeenCalled();
    expect(loggingService.info).toHaveBeenCalled();
  });

  // Allow-listed, so a customer group nobody has seen yet is ignored rather
  // than materialized.
  it.each([
    'api',
    'some_future_group',
  ])('acks and ignores events for the %s customer group', async (customerGroup) => {
    await target.handleWebhook(webhookEvent({ customerGroup }));

    expect(entitlementsService.materializeFromEvent).not.toHaveBeenCalled();
    expect(entitlementsService.materializeAuthoritative).not.toHaveBeenCalled();
    expect(billingApi.getSubscriptionsByCustomerId).not.toHaveBeenCalled();
  });

  it('materializes events for the wallet_web customer group', async () => {
    await target.handleWebhook(
      webhookEvent({ customerGroup: WALLET_WEB_CUSTOMER_GROUP }),
    );

    expect(entitlementsService.materializeFromEvent).toHaveBeenCalledTimes(1);
  });

  it('acks and warns on a missing or invalid upstreamCustomerId', async () => {
    await target.handleWebhook(webhookEvent({ upstreamCustomerId: null }));
    await target.handleWebhook(
      webhookEvent({ upstreamCustomerId: 'not-a-uuid' }),
    );

    expect(entitlementsService.materializeFromEvent).not.toHaveBeenCalled();
    expect(entitlementsService.materializeAuthoritative).not.toHaveBeenCalled();
    expect(loggingService.warn).toHaveBeenCalledTimes(2);
  });

  it('acks and warns when the space is unknown', async () => {
    spacesRepository.findIdByUuid.mockRejectedValue(
      new NotFoundException('Workspace not found.'),
    );

    await target.handleWebhook(webhookEvent());

    expect(entitlementsService.materializeFromEvent).not.toHaveBeenCalled();
    expect(entitlementsService.materializeAuthoritative).not.toHaveBeenCalled();
    expect(loggingService.warn).toHaveBeenCalled();
  });

  it('acks and warns when materialize races a space deletion', async () => {
    billingApi.getSubscriptionsByCustomerId.mockResolvedValue([]);
    entitlementsService.materializeFromEvent.mockRejectedValue(
      new NotFoundException('Workspace not found.'),
    );

    await target.handleWebhook(webhookEvent());

    expect(loggingService.warn).toHaveBeenCalled();
  });

  it('acks and warns when the subscriptions insert races a space deletion (FK violation)', async () => {
    billingApi.getSubscriptionsByCustomerId.mockResolvedValue([]);
    entitlementsService.materializeFromEvent.mockRejectedValue(
      new QueryFailedError(
        '',
        [],
        Object.assign(new Error(), {
          code: '23503',
          constraint: 'FK_subscriptions_space_id',
        }),
      ),
    );

    await target.handleWebhook(webhookEvent());

    expect(loggingService.warn).toHaveBeenCalled();
  });

  it('propagates an unrelated query failure so the webhook is retried', async () => {
    billingApi.getSubscriptionsByCustomerId.mockResolvedValue([]);
    const error = new QueryFailedError(
      '',
      [],
      // Serialization failure: transient, so retrying is exactly right.
      Object.assign(new Error(), { code: '40001' }),
    );
    entitlementsService.materializeFromEvent.mockRejectedValue(error);

    await expect(target.handleWebhook(webhookEvent())).rejects.toThrow(error);
  });

  it('propagates an unrelated foreign key violation', async () => {
    billingApi.getSubscriptionsByCustomerId.mockResolvedValue([]);
    const error = new QueryFailedError(
      '',
      [],
      Object.assign(new Error(), {
        code: '23503',
        constraint: 'FK_SE_feature_id',
      }),
    );
    entitlementsService.materializeFromEvent.mockRejectedValue(error);

    await expect(target.handleWebhook(webhookEvent())).rejects.toThrow(error);
  });

  it('propagates re-fetch errors so the webhook returns 5xx and is retried', async () => {
    billingApi.getSubscriptionsByCustomerId.mockRejectedValue(
      new Error('billing-service down'),
    );

    await expect(target.handleWebhook(partialWebhookEvent())).rejects.toThrow(
      'billing-service down',
    );
  });

  it('materializes the event payload without calling the billing service', async () => {
    const created = toSecondsTimestamp(faker.date.recent());
    const event = webhookEvent({
      type: 'customer.subscription.created',
      created,
      data: {
        currentPeriodStart: 1_786_460_184,
        currentPeriodEnd: 1_789_138_584,
        metadata: { planName: 'Business', FEATURE_SAFE_SEATS: '10' },
      },
    });

    await target.handleWebhook(event);

    expect(billingApi.getSubscriptionsByCustomerId).not.toHaveBeenCalled();
    expect(
      entitlementsService.materializeFromEvent,
    ).toHaveBeenCalledExactlyOnceWith({
      spaceId,
      // The payload's own state, stamped with the event that carried it.
      eventAt: new Date(created * 1_000),
      subscription: {
        upstreamSubscriptionId: event.data?.subscriptionId,
        status: 'active',
        planId: event.data?.planId,
        planName: 'Business',
        currentPeriodStart: new Date(1_786_460_184_000),
        currentPeriodEnd: new Date(1_789_138_584_000),
        entitlements: [
          {
            featureKey: 'safe_seats',
            enabled: true,
            quota: 10,
            value: null,
          },
        ],
      },
    });
  });

  it.each([
    ['an unknown status', { status: 'something-new' }],
    ['no subscription id', { subscriptionId: null }],
    ['no plan', { planId: null }],
    ['no billing period', { currentPeriodStart: null }],
    [
      'an unrepresentable billing period',
      { currentPeriodEnd: Number.MAX_SAFE_INTEGER },
    ],
    // Materializing it would wipe the space's stored entitlements on a payload
    // that may simply not carry them.
    ['no feature metadata on an active payload', { metadata: null }],
  ])('falls back to the re-fetch on %s', async (_, data) => {
    const subscription = subscriptionBuilder().with('status', 'active').build();
    billingApi.getSubscriptionsByCustomerId.mockResolvedValue([subscription]);

    await target.handleWebhook(webhookEvent({ data }));

    expect(entitlementsService.materializeFromEvent).not.toHaveBeenCalled();
    expect(billingApi.getSubscriptionsByCustomerId).toHaveBeenCalledTimes(1);
    expect(entitlementsService.materializeAuthoritative).toHaveBeenCalledWith({
      spaceId,
      triggerEventAt: expect.any(Date),
      observedEventAt: null,
      subscriptions: [
        expect.objectContaining({ upstreamSubscriptionId: subscription.id }),
      ],
    });
  });

  describe('ordering fallbacks', () => {
    const markedAt = new Date('2026-08-17T12:00:10.000Z');

    function upstreamState(): void {
      billingApi.getSubscriptionsByCustomerId.mockResolvedValue([
        subscriptionBuilder().with('status', 'canceled').build(),
      ]);
    }

    it('leaves upstream alone when the event write lands', async () => {
      await target.handleWebhook(webhookEvent());

      expect(entitlementsService.materializeFromEvent).toHaveBeenCalledTimes(1);
      expect(billingApi.getSubscriptionsByCustomerId).not.toHaveBeenCalled();
      expect(
        entitlementsService.materializeAuthoritative,
      ).not.toHaveBeenCalled();
    });

    // Whatever the reason materialize gives — a stale stamp, a tie, or a
    // concurrent write — the answer here is the same: ask upstream.
    it('asks upstream when the event write is not applied', async () => {
      subscriptionsRepository.getLastEventAt.mockResolvedValue(markedAt);
      entitlementsService.materializeFromEvent.mockResolvedValue(false);
      upstreamState();

      await target.handleWebhook(webhookEvent());

      expect(billingApi.getSubscriptionsByCustomerId).toHaveBeenCalledTimes(1);
      expect(
        entitlementsService.materializeAuthoritative,
      ).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          // Read before the fetch went out, so a write landing meanwhile is
          // caught under the lock.
          observedEventAt: markedAt,
          subscriptions: [expect.objectContaining({ status: 'canceled' })],
        }),
      );
      // Neither attempt may be served the other's snapshot.
      expect(cacheService.deleteByKey).toHaveBeenCalledTimes(2);
      expect(loggingService.warn).not.toHaveBeenCalled();
    });

    it('goes straight to upstream when the event carries no created stamp', async () => {
      upstreamState();

      await target.handleWebhook({ ...webhookEvent(), created: undefined });

      expect(entitlementsService.materializeFromEvent).not.toHaveBeenCalled();
      expect(
        entitlementsService.materializeAuthoritative,
      ).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ triggerEventAt: null }),
      );
    });

    it('acks with a warning when upstream is superseded too', async () => {
      entitlementsService.materializeFromEvent.mockResolvedValue(false);
      entitlementsService.materializeAuthoritative.mockResolvedValue(false);
      upstreamState();

      await target.handleWebhook(webhookEvent());

      expect(
        entitlementsService.materializeAuthoritative,
      ).toHaveBeenCalledTimes(1);
      expect(loggingService.warn).toHaveBeenCalledTimes(1);
      expect(loggingService.info).not.toHaveBeenCalled();
    });
  });
});
