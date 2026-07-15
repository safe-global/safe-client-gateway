// SPDX-License-Identifier: FSL-1.1-MIT

import {
  BillingWebhookEventSchema,
  BillingWebhookSubscriptionDataSchema,
  isRelevantSubscriptionEvent,
} from '@/modules/billing/domain/entities/billing-webhook-event.entity';

describe('BillingWebhookEventSchema', () => {
  const baseCustomer = {
    customerGroup: 'wallet_web',
    upstreamCustomerId: '4e2b6f2a-4f34-4b8a-9c8a-2f6a2e2f6a2e',
    customerId: 'cus_test123',
  };

  it.each([
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'customer.subscription.paused',
  ])('accepts a realistic %s event', (type) => {
    const result = BillingWebhookEventSchema.safeParse({
      id: 'evt_test123',
      type,
      created: 1625097600,
      data: {
        subscriptionId: 'sub_test123',
        status: 'active',
        customer: baseCustomer,
        metadata: { planType: 'vp1' },
      },
    });

    expect(result.success).toBe(true);
  });

  it('accepts an event type outside this ticket scope — relevance is decided downstream, not by the schema', () => {
    const result = BillingWebhookEventSchema.safeParse({
      id: 'evt_test123',
      type: 'checkout.session.completed',
      created: 1625097600,
      data: {
        customer: baseCustomer,
      },
    });

    expect(result.success).toBe(true);
  });

  it('accepts a data shape that does not match the subscription payload', () => {
    const result = BillingWebhookEventSchema.safeParse({
      id: 'evt_test123',
      type: 'payment_link.created',
      created: 1625097600,
      data: {
        paymentLinkId: 'plink_123',
        isActive: true,
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects a payload missing the envelope id', () => {
    const result = BillingWebhookEventSchema.safeParse({
      type: 'customer.subscription.created',
      created: 1625097600,
      data: {
        customer: baseCustomer,
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects a payload missing created', () => {
    const result = BillingWebhookEventSchema.safeParse({
      id: 'evt_test123',
      type: 'customer.subscription.created',
      data: {
        customer: baseCustomer,
      },
    });

    expect(result.success).toBe(false);
  });
});

describe('isRelevantSubscriptionEvent', () => {
  it.each([
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'customer.subscription.paused',
    'customer.subscription.resumed',
  ])('returns true for %s', (type) => {
    expect(isRelevantSubscriptionEvent(type)).toBe(true);
  });

  it.each([
    'invoice.payment_succeeded',
    'invoice.payment_failed',
    'checkout.session.completed',
    'payment_link.created',
    'payment_link.updated',
  ])('returns false for %s', (type) => {
    expect(isRelevantSubscriptionEvent(type)).toBe(false);
  });
});

describe('BillingWebhookSubscriptionDataSchema', () => {
  it('accepts a data.customer with no fields set, matching optional upstream fields', () => {
    const result = BillingWebhookSubscriptionDataSchema.safeParse({
      customer: {},
    });

    expect(result.success).toBe(true);
  });

  it('rejects a payload missing data.customer', () => {
    const result = BillingWebhookSubscriptionDataSchema.safeParse({
      subscriptionId: 'sub_test123',
      status: 'active',
    });

    expect(result.success).toBe(false);
  });
});
