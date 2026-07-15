// SPDX-License-Identifier: FSL-1.1-MIT

import { z } from 'zod';
import { UuidSchema } from '@/validation/entities/schemas/uuid.schema';

// CGW is only registered for the wallet_web customer group
export const WALLET_WEB_CUSTOMER_GROUP = 'wallet_web' as const;

export const BillingWebhookCustomerSchema = z.object({
  customerGroup: z.literal(WALLET_WEB_CUSTOMER_GROUP).optional(),
  // Matches spaces.uuid.
  upstreamCustomerId: UuidSchema.optional(),
});

// The payload is thin — plan/period/price details are not carried here and
// are fetched separately via IBillingApi once an event is relevant.
export const BillingWebhookSubscriptionDataSchema = z.object({
  subscriptionId: z.string().optional(),
  status: z.string().optional(),
  customer: BillingWebhookCustomerSchema,
  metadata: z.record(z.string(), z.string()).optional(),
});

// Only these are processed — see isRelevantSubscriptionEvent.
export const SubscriptionRelevantEventTypes = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
] as const;

export type SubscriptionRelevantEventType =
  (typeof SubscriptionRelevantEventTypes)[number];

export function isRelevantSubscriptionEvent(
  type: string,
): type is SubscriptionRelevantEventType {
  return (SubscriptionRelevantEventTypes as ReadonlyArray<string>).includes(
    type,
  );
}

// type/data are unconstrained here so unrecognized events are acked, not
// rejected; the stricter shape is parsed once relevance is confirmed.
export const BillingWebhookEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  created: z.number().int(),
  data: z.record(z.string(), z.unknown()),
});

export type BillingWebhookEvent = z.infer<typeof BillingWebhookEventSchema>;
