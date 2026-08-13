// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { MockedObject } from 'vitest';
import { subscriptionBuilder } from '@/datasources/billing-api/entities/__tests__/subscription.builder';
import { CacheRouter } from '@/datasources/cache/cache.router';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import type { IBillingApi } from '@/domain/interfaces/billing-api.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type { IEntitlementsRepository } from '@/modules/entitlements/domain/entitlements.repository.interface';
import { SubscriptionSyncService } from '@/modules/entitlements/domain/subscription-sync.service';
import { fakeUuid } from '@/validation/entities/schemas/__tests__/uuid.builder';

describe('SubscriptionSyncService', () => {
  const spaceId = faker.number.int({ min: 1, max: 100_000 });
  const spaceUuid = fakeUuid();

  let billingApi: MockedObject<IBillingApi>;
  let entitlementsRepository: MockedObject<IEntitlementsRepository>;
  let cacheService: MockedObject<ICacheService>;
  let postgresDatabaseService: MockedObject<PostgresDatabaseService>;
  let loggingService: MockedObject<ILoggingService>;
  let entityManager: { findOne: ReturnType<typeof vi.fn> };
  let target: SubscriptionSyncService;

  function webhookEvent(overrides?: {
    type?: string;
    upstreamCustomerId?: string | null;
    customerGroup?: string;
  }): unknown {
    return {
      id: faker.string.uuid(),
      type: overrides?.type ?? 'checkout.session.completed',
      created: faker.number.int(),
      data: {
        subscriptionId: faker.string.uuid(),
        status: 'active',
        customer: {
          customerGroup: overrides?.customerGroup ?? 'wallet_web',
          upstreamCustomerId:
            overrides?.upstreamCustomerId === undefined
              ? spaceUuid.replaceAll('-', '')
              : overrides.upstreamCustomerId,
          customerId: faker.string.uuid(),
        },
        metadata: null,
      },
    };
  }

  beforeEach(() => {
    vi.resetAllMocks();

    billingApi = {
      getSubscriptionsByCustomerId: vi.fn(),
    } as unknown as MockedObject<IBillingApi>;
    entitlementsRepository = {
      materialize: vi.fn(),
    } as unknown as MockedObject<IEntitlementsRepository>;
    cacheService = {
      deleteByKey: vi.fn(),
    } as unknown as MockedObject<ICacheService>;
    entityManager = {
      findOne: vi.fn().mockResolvedValue({ id: spaceId }),
    };
    postgresDatabaseService = {
      initializeDatabaseConnection: vi
        .fn()
        .mockResolvedValue({ manager: entityManager }),
    } as unknown as MockedObject<PostgresDatabaseService>;
    loggingService = {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    } as MockedObject<ILoggingService>;

    target = new SubscriptionSyncService(
      billingApi,
      entitlementsRepository,
      cacheService,
      postgresDatabaseService,
      loggingService,
    );
  });

  it('re-fetches upstream state and materializes it for a subscription event', async () => {
    const active = subscriptionBuilder()
      .with('status', 'active')
      .with('createdAt', 2)
      .with('startAt', 1_700_000_000)
      .with('validUntil', 1_702_592_000)
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

    await target.handleWebhook(webhookEvent());

    // The billing-api Redis cache is busted before the re-fetch.
    expect(cacheService.deleteByKey).toHaveBeenCalledWith(
      CacheRouter.getBillingSubscriptionsCacheKey(spaceUuid),
    );
    expect(billingApi.getSubscriptionsByCustomerId).toHaveBeenCalledWith({
      upstreamCustomerId: spaceUuid,
      status: 'all',
    });
    expect(entitlementsRepository.materialize).toHaveBeenCalledExactlyOnceWith({
      spaceId,
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
    // The space entitlements cache is invalidated after materialization.
    expect(cacheService.deleteByKey).toHaveBeenCalledWith(
      CacheRouter.getSpaceEntitlementsCacheKey(spaceId),
    );
  });

  it('is idempotent: processing the same event twice materializes the same state', async () => {
    const subscription = subscriptionBuilder().with('status', 'active').build();
    billingApi.getSubscriptionsByCustomerId.mockResolvedValue([subscription]);
    const event = webhookEvent({ type: 'customer.subscription.updated' });

    await target.handleWebhook(event);
    await target.handleWebhook(event);

    expect(entitlementsRepository.materialize).toHaveBeenCalledTimes(2);
    const [first, second] = entitlementsRepository.materialize.mock.calls.map(
      ([args]) => args,
    );
    expect(second).toStrictEqual(first);
  });

  it('keeps only the newest active subscription when upstream has several', async () => {
    const older = subscriptionBuilder()
      .with('status', 'active')
      .with('createdAt', 1)
      .build();
    const newer = subscriptionBuilder()
      .with('status', 'active')
      .with('createdAt', 2)
      .build();
    billingApi.getSubscriptionsByCustomerId.mockResolvedValue([older, newer]);

    await target.handleWebhook(webhookEvent());

    const [args] = entitlementsRepository.materialize.mock.calls[0];
    expect(args.subscriptions).toHaveLength(1);
    expect(args.subscriptions[0].upstreamSubscriptionId).toBe(newer.id);
    expect(loggingService.warn).toHaveBeenCalled();
  });

  it.each([
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'customer.subscription.paused',
    'invoice.payment_succeeded',
    'invoice.payment_failed',
  ])('handles the %s event type as a trigger', async (type) => {
    billingApi.getSubscriptionsByCustomerId.mockResolvedValue([]);

    await target.handleWebhook(webhookEvent({ type }));

    expect(entitlementsRepository.materialize).toHaveBeenCalledTimes(1);
  });

  it('invalidates the payment links cache and skips materialization for payment_link events', async () => {
    await target.handleWebhook(webhookEvent({ type: 'payment_link.created' }));

    expect(cacheService.deleteByKey).toHaveBeenCalledExactlyOnceWith(
      CacheRouter.getBillingPaymentLinksCacheDir().key,
    );
    expect(billingApi.getSubscriptionsByCustomerId).not.toHaveBeenCalled();
    expect(entitlementsRepository.materialize).not.toHaveBeenCalled();
  });

  it('acks and ignores unknown event types', async () => {
    await target.handleWebhook(webhookEvent({ type: 'something.new' }));

    expect(entitlementsRepository.materialize).not.toHaveBeenCalled();
    expect(loggingService.info).toHaveBeenCalled();
  });

  it('acks and ignores events for the api customer group', async () => {
    await target.handleWebhook(webhookEvent({ customerGroup: 'api' }));

    expect(entitlementsRepository.materialize).not.toHaveBeenCalled();
  });

  it('acks and warns on a missing or invalid upstreamCustomerId', async () => {
    await target.handleWebhook(webhookEvent({ upstreamCustomerId: null }));
    await target.handleWebhook(
      webhookEvent({ upstreamCustomerId: 'not-a-uuid' }),
    );

    expect(entitlementsRepository.materialize).not.toHaveBeenCalled();
    expect(loggingService.warn).toHaveBeenCalledTimes(2);
  });

  it('acks and warns when the space is unknown', async () => {
    entityManager.findOne.mockResolvedValue(null);

    await target.handleWebhook(webhookEvent());

    expect(entitlementsRepository.materialize).not.toHaveBeenCalled();
    expect(loggingService.warn).toHaveBeenCalled();
  });

  it('acks and logs malformed payloads', async () => {
    await target.handleWebhook({ not: 'an event' });

    expect(entitlementsRepository.materialize).not.toHaveBeenCalled();
    expect(loggingService.error).toHaveBeenCalled();
  });

  it('propagates re-fetch errors so the webhook returns 5xx and is retried', async () => {
    billingApi.getSubscriptionsByCustomerId.mockRejectedValue(
      new Error('billing-service down'),
    );

    await expect(target.handleWebhook(webhookEvent())).rejects.toThrow(
      'billing-service down',
    );
  });
});
