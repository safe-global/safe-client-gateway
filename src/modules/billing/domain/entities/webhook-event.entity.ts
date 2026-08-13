// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { StripeMetadataSchema } from '@/datasources/billing-api/entities/metadata.entity';
import { withDashes } from '@/datasources/billing-api/upstream-customer-id.util';

/** Customer group of the Safe{Wallet} web app, the only one entitlements track. */
export const WALLET_WEB_CUSTOMER_GROUP = 'wallet_web';

/** Event types carrying a full subscription snapshot to materialize. */
export const WebhookSubscriptionEventTypes = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
] as const;

export const WebhookPaymentLinkEventTypes = [
  'payment_link.created',
  'payment_link.updated',
] as const;

/**
 * Known types deliberately dropped, as distinct from types we have never heard
 * of: each describes a session or an invoice rather than a subscription, and
 * each has a `customer.subscription.*` counterpart reporting the same state
 * change with the snapshot attached.
 */
export const WebhookIgnoredEventTypes = [
  'checkout.session.completed',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
] as const;

export function isSubscriptionEventType(type: string): boolean {
  return (WebhookSubscriptionEventTypes as ReadonlyArray<string>).includes(
    type,
  );
}

export function isPaymentLinkEventType(type: string): boolean {
  return (WebhookPaymentLinkEventTypes as ReadonlyArray<string>).includes(type);
}

export function isIgnoredEventType(type: string): boolean {
  return (WebhookIgnoredEventTypes as ReadonlyArray<string>).includes(type);
}

export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

export const WebhookEventSchema = z.object({
  id: z.string(),
  // Unknown types must not fail parsing.
  type: z.string(),
  created: z.number().optional(),
  data: z
    .looseObject({
      subscriptionId: z.string().nullish(),
      status: z.string().nullish(),
      planId: z.string().nullish(),
      currentPeriodStart: z.number().nullish(),
      currentPeriodEnd: z.number().nullish(),
      metadata: StripeMetadataSchema.nullish(),
      customer: z
        .looseObject({
          customerGroup: z.string().nullish(),
          upstreamCustomerId: z
            .string()
            .nullish()
            .transform((value) => (value == null ? null : withDashes(value))),
          customerId: z.string().nullish(),
        })
        .nullish(),
    })
    .nullish(),
});
