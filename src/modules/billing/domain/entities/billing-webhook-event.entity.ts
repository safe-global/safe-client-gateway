// SPDX-License-Identifier: FSL-1.1-MIT

import { z } from 'zod';
import { UuidSchema } from '@/validation/entities/schemas/uuid.schema';

// CGW is only registered for the wallet_web customer group
export const WALLET_WEB_CUSTOMER_GROUP = 'wallet_web' as const;

export const BillingWebhookCustomerSchema = z.object({
  customerGroup: z.literal(WALLET_WEB_CUSTOMER_GROUP).optional(),
  // Matches spaces.uuid.
  upstreamCustomerId: UuidSchema.optional(),
  customerId: z.string().optional(),
});

// The payload is thin — plan/period/price details are not carried here and
// are fetched separately via IBillingApi once an event is relevant.
export const BillingWebhookSubscriptionDataSchema = z.object({
  subscriptionId: z.string().optional(),
  status: z.string().optional(),
  customer: BillingWebhookCustomerSchema,
  metadata: z.record(z.string(), z.string()).optional(),
});

// Only these are processed — see isRelevantSubscriptionEvent. invoice.* is
// deliberately excluded: its data shape is unconfirmed (the reference
// implementation never processes invoice events either), and a subscription
// status change is re-delivered via customer.subscription.updated regardless.
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

// billing-service's event catalog is wider than what CGW acts on — `type`
// and `data` are intentionally unconstrained at this layer so an
// unrecognized or irrelevant event is acknowledged (and ignored, see
// isRelevantSubscriptionEvent) rather than rejected as an invalid payload.
// The stricter subscription-data shape is only parsed once an event is
// confirmed relevant.
export const BillingWebhookEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  created: z.number().int(),
  data: z.record(z.string(), z.unknown()),
});

export type BillingWebhookEvent = z.infer<typeof BillingWebhookEventSchema>;
