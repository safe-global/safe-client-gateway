// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { MockedObject } from 'vitest';
import { subscriptionBuilder } from '@/datasources/billing-api/entities/__tests__/subscription.builder';
import type { SubscriptionStatus as BillingSubscriptionStatus } from '@/datasources/billing-api/entities/subscription.entity';
import { CacheRouter } from '@/datasources/cache/cache.router';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { IBillingApi } from '@/domain/interfaces/billing-api.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type { BillingWebhookEvent } from '@/modules/billing/domain/entities/billing-webhook-event.entity';
import { BillingWebhookService } from '@/modules/billing/routes/billing-webhook.service';
import type { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import type { SubscriptionStatus } from '@/modules/subscriptions/domain/entities/subscription.entity';
import type { ISubscriptionsRepository } from '@/modules/subscriptions/domain/subscriptions.repository.interface';

const mockLoggingService = vi.mocked({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
} as unknown as MockedObject<ILoggingService>);

const mockCacheService = vi.mocked({
  getCounter: vi.fn(),
  hSet: vi.fn(),
  hGet: vi.fn(),
  deleteByKey: vi.fn(),
  increment: vi.fn(),
  setCounter: vi.fn(),
} as unknown as MockedObject<ICacheService>);

const mockBillingApi = vi.mocked({
  listPlans: vi.fn(),
  getPlan: vi.fn(),
  getCustomer: vi.fn(),
  getSubscriptionsByCustomerId: vi.fn(),
  listPaymentLinks: vi.fn(),
  createCheckoutSession: vi.fn(),
  getCheckoutSession: vi.fn(),
} as unknown as MockedObject<IBillingApi>);

const mockSubscriptionsRepository = vi.mocked({
  upsertFromEvent: vi.fn(),
  findBySpaceId: vi.fn(),
  findById: vi.fn(),
} as unknown as MockedObject<ISubscriptionsRepository>);

const mockSpacesRepository = vi.mocked({
  findOne: vi.fn(),
} as unknown as MockedObject<ISpacesRepository>);

function webhookEventBuilder(
  overrides: Partial<BillingWebhookEvent> = {},
): BillingWebhookEvent {
  return {
    id: faker.string.uuid(),
    type: 'customer.subscription.created',
    created: faker.number.int({ min: 1_600_000_000, max: 1_900_000_000 }),
    data: {
      subscriptionId: faker.string.uuid(),
      status: 'active',
      customer: { upstreamCustomerId: faker.string.uuid() },
    },
    ...overrides,
  };
}

describe('BillingWebhookService', () => {
  let target: BillingWebhookService;

  beforeEach(() => {
    vi.resetAllMocks();
    target = new BillingWebhookService(
      mockLoggingService,
      mockCacheService,
      mockBillingApi,
      mockSubscriptionsRepository,
      mockSpacesRepository,
    );
  });

  it('no-ops when the event type is not relevant', async () => {
    const event = webhookEventBuilder({ type: 'invoice.payment_succeeded' });

    await target.handle(event);

    expect(mockSpacesRepository.findOne).not.toHaveBeenCalled();
    expect(mockCacheService.deleteByKey).not.toHaveBeenCalled();
    expect(mockBillingApi.getSubscriptionsByCustomerId).not.toHaveBeenCalled();
    expect(mockSubscriptionsRepository.upsertFromEvent).not.toHaveBeenCalled();
    expect(mockLoggingService.warn).toHaveBeenCalledOnce();
    expect(mockLoggingService.error).not.toHaveBeenCalled();
  });

  it('no-ops when data does not match the expected subscription shape', async () => {
    const event = webhookEventBuilder({
      data: { paymentLinkId: 'plink_123', isActive: true },
    });

    await target.handle(event);

    expect(mockSpacesRepository.findOne).not.toHaveBeenCalled();
    expect(mockCacheService.deleteByKey).not.toHaveBeenCalled();
    expect(mockBillingApi.getSubscriptionsByCustomerId).not.toHaveBeenCalled();
    expect(mockSubscriptionsRepository.upsertFromEvent).not.toHaveBeenCalled();
    expect(mockLoggingService.error).toHaveBeenCalledOnce();
  });

  it('no-ops when upstreamCustomerId is missing', async () => {
    const event = webhookEventBuilder({
      data: {
        subscriptionId: faker.string.uuid(),
        status: 'active',
        customer: {},
      },
    });

    await target.handle(event);

    expect(mockSpacesRepository.findOne).not.toHaveBeenCalled();
    expect(mockCacheService.deleteByKey).not.toHaveBeenCalled();
    expect(mockBillingApi.getSubscriptionsByCustomerId).not.toHaveBeenCalled();
    expect(mockSubscriptionsRepository.upsertFromEvent).not.toHaveBeenCalled();
    expect(mockLoggingService.error).toHaveBeenCalledOnce();
  });

  it('no-ops when subscriptionId is missing', async () => {
    const event = webhookEventBuilder({
      data: {
        status: 'active',
        customer: { upstreamCustomerId: faker.string.uuid() },
      },
    });

    await target.handle(event);

    expect(mockSpacesRepository.findOne).not.toHaveBeenCalled();
    expect(mockCacheService.deleteByKey).not.toHaveBeenCalled();
    expect(mockBillingApi.getSubscriptionsByCustomerId).not.toHaveBeenCalled();
    expect(mockSubscriptionsRepository.upsertFromEvent).not.toHaveBeenCalled();
    expect(mockLoggingService.warn).toHaveBeenCalledOnce();
  });

  it('no-ops when the Space cannot be resolved', async () => {
    const event = webhookEventBuilder();
    mockSpacesRepository.findOne.mockResolvedValue(null);

    await target.handle(event);

    expect(mockCacheService.deleteByKey).not.toHaveBeenCalled();
    expect(mockBillingApi.getSubscriptionsByCustomerId).not.toHaveBeenCalled();
    expect(mockSubscriptionsRepository.upsertFromEvent).not.toHaveBeenCalled();
    expect(mockLoggingService.error).toHaveBeenCalledOnce();
  });

  it('no-ops when the subscription is not found upstream', async () => {
    const event = webhookEventBuilder();
    mockSpacesRepository.findOne.mockResolvedValue({
      id: faker.number.int(),
    } as Space);
    mockBillingApi.getSubscriptionsByCustomerId.mockResolvedValue([
      subscriptionBuilder().build(),
    ]);

    await target.handle(event);

    // The cache is invalidated before the lookup, since a fresh (but empty)
    // result is still more correct than a stale cached one.
    expect(mockCacheService.deleteByKey).toHaveBeenCalledOnce();
    expect(mockSubscriptionsRepository.upsertFromEvent).not.toHaveBeenCalled();
    expect(mockLoggingService.warn).toHaveBeenCalledOnce();
  });

  it('upserts the subscription on a relevant event', async () => {
    const spaceId = faker.number.int();
    const subscriptionId = faker.string.uuid();
    const upstreamCustomerId = faker.string.uuid();
    const metadata = { plan: 'premium' };
    const subscription = subscriptionBuilder()
      .with('id', subscriptionId)
      .with('upstreamCustomerId', upstreamCustomerId)
      .with('status', 'active')
      .build();
    const event = webhookEventBuilder({
      data: {
        subscriptionId,
        status: 'active',
        customer: { upstreamCustomerId },
        metadata,
      },
    });
    mockSpacesRepository.findOne.mockResolvedValue({ id: spaceId } as Space);
    mockBillingApi.getSubscriptionsByCustomerId.mockResolvedValue([
      subscription,
    ]);

    await target.handle(event);

    expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(
      CacheRouter.getBillingSubscriptionsCacheDir({
        upstreamCustomerId,
        status: 'all',
      }).key,
    );
    expect(mockBillingApi.getSubscriptionsByCustomerId).toHaveBeenCalledWith({
      upstreamCustomerId,
      status: 'all',
    });
    expect(mockSubscriptionsRepository.upsertFromEvent).toHaveBeenCalledWith({
      id: subscription.id,
      spaceId,
      status: 'active',
      metadata,
      lastEventId: event.id,
      lastEventOccurredAt: new Date(event.created * 1000),
    });
  });

  it('stores an empty metadata object when the event carries none', async () => {
    const spaceId = faker.number.int();
    const subscription = subscriptionBuilder().build();
    const event = webhookEventBuilder({
      data: {
        subscriptionId: subscription.id,
        status: subscription.status,
        customer: { upstreamCustomerId: subscription.upstreamCustomerId },
      },
    });
    mockSpacesRepository.findOne.mockResolvedValue({ id: spaceId } as Space);
    mockBillingApi.getSubscriptionsByCustomerId.mockResolvedValue([
      subscription,
    ]);

    await target.handle(event);

    expect(mockSubscriptionsRepository.upsertFromEvent).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: {} }),
    );
  });

  it.each([
    ['active', 'active'],
    ['trialing', 'active'],
    ['past_due', 'past_due'],
    ['unpaid', 'past_due'],
    ['paused', 'paused'],
    ['canceled', 'canceled'],
    ['incomplete', 'canceled'],
    ['incomplete_expired', 'canceled'],
  ] satisfies Array<
    [BillingSubscriptionStatus, SubscriptionStatus]
  >)('maps billing status %s to %s', async (billingStatus, expectedStatus) => {
    const spaceId = faker.number.int();
    const subscription = subscriptionBuilder()
      .with('status', billingStatus)
      .with('cancelAt', null)
      .build();
    const event = webhookEventBuilder({
      data: {
        subscriptionId: subscription.id,
        status: billingStatus,
        customer: { upstreamCustomerId: subscription.upstreamCustomerId },
      },
    });
    mockSpacesRepository.findOne.mockResolvedValue({ id: spaceId } as Space);
    mockBillingApi.getSubscriptionsByCustomerId.mockResolvedValue([
      subscription,
    ]);

    await target.handle(event);

    expect(mockSubscriptionsRepository.upsertFromEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: expectedStatus }),
    );
  });
});
