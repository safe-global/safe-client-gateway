// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { StripeMetadataSchema } from '@/datasources/billing-api/entities/metadata.entity';
import { withDashes } from '@/datasources/billing-api/upstream-customer-id.util';

/** Customer group of the Safe{Wallet} web app, the only one entitlements track. */
export const WALLET_WEB_CUSTOMER_GROUP = 'wallet_web';

/**
 * Namespace of the event types that say a subscription changed. Matched by
 * prefix rather than enumerated: an allow-list has to track upstream's
 * catalog forever, and a type missing from it drifts silently — `resumed`
 * was, so a reactivated subscription stayed paused here until the next
 * event happened along. Whether a given event's payload can be trusted as a
 * complete snapshot is a separate question, answered per payload.
 */
const SUBSCRIPTION_EVENT_TYPE_PREFIX = 'customer.subscription.';

export const WebhookPaymentLinkEventTypes = [
  'payment_link.created',
  'payment_link.updated',
] as const;

export function isSubscriptionEventType(type: string): boolean {
  return type.startsWith(SUBSCRIPTION_EVENT_TYPE_PREFIX);
}

export function isPaymentLinkEventType(type: string): boolean {
  return (WebhookPaymentLinkEventTypes as ReadonlyArray<string>).includes(type);
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
