// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { MockedObject } from 'vitest';
import { subscriptionBuilder } from '@/datasources/billing-api/entities/__tests__/subscription.builder';
import { CacheRouter } from '@/datasources/cache/cache.router';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { IBillingApi } from '@/domain/interfaces/billing-api.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type { Feature } from '@/modules/entitlements/domain/entities/feature.entity';
import type { IFeaturesRepository } from '@/modules/entitlements/domain/features.repository.interface';
import { EntitlementsService } from '@/modules/entitlements/routes/entitlements.service';
import { SubscriptionSyncService } from '@/modules/entitlements/routes/subscription-sync.service';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { fakeUuid } from '@/validation/entities/schemas/__tests__/uuid.builder';

function featureFixture(overrides: Pick<Feature, 'key' | 'type'>): Feature {
  return {
    id: faker.number.int({ min: 1, max: 100_000 }),
    createdAt: new Date(),
    updatedAt: new Date(),
    description: faker.lorem.sentence(),
    freeEnabled: false,
    freeQuota: null,
    freeValue: null,
    freePeriod: null,
    ...overrides,
  };
}

const FEATURES: Array<Feature> = [
  featureFixture({ key: 'safe_seats', type: 'metered' }),
];

describe('SubscriptionSyncService', () => {
  const spaceId = faker.number.int({ min: 1, max: 100_000 });
  const spaceUuid = fakeUuid();

  let billingApi: MockedObject<IBillingApi>;
  let entitlementsService: MockedObject<
    Pick<EntitlementsService, 'materialize'>
  >;
  let spacesRepository: MockedObject<Pick<ISpacesRepository, 'findIdByUuid'>>;
  let featuresRepository: MockedObject<IFeaturesRepository>;
  let cacheService: MockedObject<ICacheService>;
  let loggingService: MockedObject<ILoggingService>;
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
    entitlementsService = {
      materialize: vi.fn(),
    };
    spacesRepository = {
      findIdByUuid: vi.fn().mockResolvedValue(spaceId),
    };
    featuresRepository = {
      getFeatures: vi.fn().mockResolvedValue(FEATURES),
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
      cacheService,
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
      CacheRouter.getBillingSubscriptionsCacheDir({
        upstreamCustomerId: spaceUuid,
        status: 'all',
      }).key,
    );
    expect(billingApi.getSubscriptionsByCustomerId).toHaveBeenCalledWith({
      upstreamCustomerId: spaceUuid,
      status: 'all',
    });
    expect(entitlementsService.materialize).toHaveBeenCalledExactlyOnceWith({
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
  });

  it('is idempotent: processing the same event twice materializes the same state', async () => {
    const subscription = subscriptionBuilder().with('status', 'active').build();
    billingApi.getSubscriptionsByCustomerId.mockResolvedValue([subscription]);
    const event = webhookEvent({ type: 'customer.subscription.updated' });

    await target.handleWebhook(event);
    await target.handleWebhook(event);

    expect(entitlementsService.materialize).toHaveBeenCalledTimes(2);
    const [first, second] = entitlementsService.materialize.mock.calls.map(
      ([args]) => args,
    );
    expect(second).toStrictEqual(first);
  });

  it('demotes surplus active subscriptions to canceled instead of dropping them', async () => {
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

    // A plain array (rather than arrayContaining) also pins the length to
    // exactly 2 — the demoted subscription is kept, not dropped.
    expect(entitlementsService.materialize).toHaveBeenCalledWith({
      spaceId,
      subscriptions: [
        expect.objectContaining({
          upstreamSubscriptionId: older.id,
          status: 'canceled',
        }),
        expect.objectContaining({
          upstreamSubscriptionId: newer.id,
          status: 'active',
        }),
      ],
    });
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

    expect(entitlementsService.materialize).toHaveBeenCalledTimes(1);
  });

  it('invalidates the payment links cache and skips materialization for payment_link events', async () => {
    await target.handleWebhook(webhookEvent({ type: 'payment_link.created' }));

    expect(cacheService.deleteByKey).toHaveBeenCalledExactlyOnceWith(
      CacheRouter.getBillingPaymentLinksCacheDir().key,
    );
    expect(billingApi.getSubscriptionsByCustomerId).not.toHaveBeenCalled();
    expect(entitlementsService.materialize).not.toHaveBeenCalled();
  });

  it('acks and ignores unknown event types', async () => {
    await target.handleWebhook(webhookEvent({ type: 'something.new' }));

    expect(entitlementsService.materialize).not.toHaveBeenCalled();
    expect(loggingService.info).toHaveBeenCalled();
  });

  it('acks and ignores events for the api customer group', async () => {
    await target.handleWebhook(webhookEvent({ customerGroup: 'api' }));

    expect(entitlementsService.materialize).not.toHaveBeenCalled();
  });

  it('acks and warns on a missing or invalid upstreamCustomerId', async () => {
    await target.handleWebhook(webhookEvent({ upstreamCustomerId: null }));
    await target.handleWebhook(
      webhookEvent({ upstreamCustomerId: 'not-a-uuid' }),
    );

    expect(entitlementsService.materialize).not.toHaveBeenCalled();
    expect(loggingService.warn).toHaveBeenCalledTimes(2);
  });

  it('acks and warns when the space is unknown', async () => {
    spacesRepository.findIdByUuid.mockRejectedValue(
      new NotFoundException('Workspace not found.'),
    );

    await target.handleWebhook(webhookEvent());

    expect(entitlementsService.materialize).not.toHaveBeenCalled();
    expect(loggingService.warn).toHaveBeenCalled();
  });

  it('acks and warns when materialize races a space deletion', async () => {
    billingApi.getSubscriptionsByCustomerId.mockResolvedValue([]);
    entitlementsService.materialize.mockRejectedValue(
      new NotFoundException('Workspace not found.'),
    );

    await target.handleWebhook(webhookEvent());

    expect(loggingService.warn).toHaveBeenCalled();
  });

  it('acks and warns when the subscriptions insert races a space deletion (FK violation)', async () => {
    billingApi.getSubscriptionsByCustomerId.mockResolvedValue([]);
    entitlementsService.materialize.mockRejectedValue(
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
    entitlementsService.materialize.mockRejectedValue(error);

    await expect(target.handleWebhook(webhookEvent())).rejects.toThrow(error);
  });

  it('acks and logs malformed payloads', async () => {
    await target.handleWebhook({ not: 'an event' });

    expect(entitlementsService.materialize).not.toHaveBeenCalled();
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
