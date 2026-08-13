// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { StripeMetadataSchema } from '@/datasources/billing-api/entities/metadata.entity';
import { withDashes } from '@/datasources/billing-api/upstream-customer-id.util';

/**
 * The webhook event contract forwarded by the billing service
 * (safe-auth-service `app/models/billing.py`, camelCase on the wire).
 *
 * `type` is deliberately validated as a plain string: webhooks must not fail
 * on event types added upstream later — unhandled types are acked and ignored.
 *
 * Only the `customer.subscription.*` types below drive materialization: they
 * are the only ones carrying a subscription snapshot. `checkout.session.completed`
 * and `invoice.payment_*` describe a session or an invoice, never a
 * subscription, so they are acked and ignored — each of them has a
 * `customer.subscription.*` counterpart that reports the same state change.
 */
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

export function isSubscriptionEventType(type: string): boolean {
  return (WebhookSubscriptionEventTypes as ReadonlyArray<string>).includes(
    type,
  );
}

export function isPaymentLinkEventType(type: string): boolean {
  return (WebhookPaymentLinkEventTypes as ReadonlyArray<string>).includes(type);
}

export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

export const WebhookEventSchema = z.object({
  id: z.string(),
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
