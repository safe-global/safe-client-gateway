// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { MockedObject } from 'vitest';
import { ZodError } from 'zod';
import { checkoutSessionResultBuilder } from '@/datasources/billing-api/entities/__tests__/checkout-session.builder';
import { paymentLinkBuilder } from '@/datasources/billing-api/entities/__tests__/payment-link.builder';
import { subscriptionBuilder } from '@/datasources/billing-api/entities/__tests__/subscription.builder';
import { stripDashes } from '@/datasources/billing-api/upstream-customer-id.util';
import type { IBillingApi } from '@/domain/interfaces/billing-api.interface';
import { BillingRepository } from '@/modules/billing/domain/billing.repository';
import { rawify } from '@/validation/entities/raw.entity';

const billingApiMock = {
  listPlans: vi.fn(),
  getPlan: vi.fn(),
  getCustomer: vi.fn(),
  getCustomerSessionUrl: vi.fn(),
  getSubscriptionsByCustomerId: vi.fn(),
  listPaymentLinks: vi.fn(),
  createCheckoutSession: vi.fn(),
  getCheckoutSession: vi.fn(),
  previewSubscriptionUpdate: vi.fn(),
  updateSubscription: vi.fn(),
  clearSubscriptions: vi.fn(),
} as MockedObject<IBillingApi>;

describe('BillingRepository', () => {
  let target: BillingRepository;

  beforeEach(() => {
    vi.resetAllMocks();
    target = new BillingRepository(billingApiMock);
  });

  describe('envelope unwrapping', () => {
    it('should unwrap the subscriptions collection', async () => {
      const subscriptions = [subscriptionBuilder().build()];
      billingApiMock.getSubscriptionsByCustomerId.mockResolvedValue(
        rawify({ subscriptions }),
      );

      await expect(
        target.getSubscriptionsByCustomerId({
          upstreamCustomerId: faker.string.uuid(),
        }),
      ).resolves.toEqual(subscriptions);
    });

    it('should unwrap the payment-links collection', async () => {
      const paymentLinks = [paymentLinkBuilder().build()];
      billingApiMock.listPaymentLinks.mockResolvedValue(
        rawify({ paymentLinks }),
      );

      await expect(target.listPaymentLinks()).resolves.toEqual(paymentLinks);
    });
  });

  describe('schema behaviour', () => {
    it('should restore dashes in a hex-only upstreamCustomerId on a subscription', async () => {
      const subscription = subscriptionBuilder().build();
      billingApiMock.getSubscriptionsByCustomerId.mockResolvedValue(
        rawify({
          subscriptions: [
            {
              ...subscription,
              upstreamCustomerId: stripDashes(subscription.upstreamCustomerId),
            },
          ],
        }),
      );

      await expect(
        target.getSubscriptionsByCustomerId({
          upstreamCustomerId: faker.string.uuid(),
        }),
      ).resolves.toEqual([subscription]);
    });

    it('should accept a plan with absent name/description/billingCycle and a null originalPrice', async () => {
      const subscription = subscriptionBuilder().build();
      const { name, description, billingCycle, ...planWithoutOptionals } =
        subscription.plan;
      const plan = { ...planWithoutOptionals, originalPrice: null };
      billingApiMock.getSubscriptionsByCustomerId.mockResolvedValue(
        rawify({ subscriptions: [{ ...subscription, plan }] }),
      );

      await expect(
        target.getSubscriptionsByCustomerId({
          upstreamCustomerId: faker.string.uuid(),
        }),
      ).resolves.toEqual([{ ...subscription, plan }]);
    });
  });

  describe('rejecting a malformed response', () => {
    it.each([
      [
        'listPaymentLinks',
        (): unknown =>
          billingApiMock.listPaymentLinks.mockResolvedValue(
            rawify({ paymentLinks: [{ malformed: true }] }),
          ),
        (): Promise<unknown> => target.listPaymentLinks(),
      ],
      [
        'createCheckoutSession',
        (): unknown =>
          billingApiMock.createCheckoutSession.mockResolvedValue(
            rawify({ malformed: true }),
          ),
        (): Promise<unknown> =>
          target.createCheckoutSession({
            paymentLinkId: faker.string.alphanumeric(32),
            upstreamCustomerId: faker.string.uuid(),
            returnUrl: faker.internet.url(),
          }),
      ],
      [
        'getCheckoutSession',
        (): unknown =>
          billingApiMock.getCheckoutSession.mockResolvedValue(
            rawify({ malformed: true }),
          ),
        (): Promise<unknown> =>
          target.getCheckoutSession({
            sessionId: faker.string.alphanumeric(32),
          }),
      ],
      [
        'previewSubscriptionUpdate',
        (): unknown =>
          billingApiMock.previewSubscriptionUpdate.mockResolvedValue(
            rawify({ malformed: true }),
          ),
        (): Promise<unknown> =>
          target.previewSubscriptionUpdate({
            upstreamCustomerId: faker.string.uuid(),
            subscriptionId: faker.string.alphanumeric(32),
            planId: faker.string.alphanumeric(32),
          }),
      ],
      [
        'updateSubscription',
        (): unknown =>
          billingApiMock.updateSubscription.mockResolvedValue(
            rawify({ malformed: true }),
          ),
        (): Promise<unknown> =>
          target.updateSubscription({
            upstreamCustomerId: faker.string.uuid(),
            subscriptionId: faker.string.alphanumeric(32),
            planId: faker.string.alphanumeric(32),
            paymentLinkId: faker.string.alphanumeric(32),
          }),
      ],
    ])('should throw a ZodError from %s', async (_name, arrange, act) => {
      arrange();

      await expect(act()).rejects.toThrow(ZodError);
    });
  });

  it('should pass a checkout session result through its schema', async () => {
    const result = checkoutSessionResultBuilder().build();
    billingApiMock.createCheckoutSession.mockResolvedValue(rawify(result));

    await expect(
      target.createCheckoutSession({
        paymentLinkId: faker.string.alphanumeric(32),
        upstreamCustomerId: faker.string.uuid(),
        returnUrl: faker.internet.url(),
      }),
    ).resolves.toEqual(result);
  });

  it('should delegate a cache invalidation without parsing anything', async () => {
    const upstreamCustomerId = faker.string.uuid();

    await target.clearSubscriptions({ upstreamCustomerId });

    expect(billingApiMock.clearSubscriptions).toHaveBeenCalledWith({
      upstreamCustomerId,
    });
  });
});
