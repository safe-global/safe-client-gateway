// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { StripeMetadataSchema } from '@/datasources/billing-api/entities/metadata.entity';
import { SubscriptionPlanSchema } from '@/datasources/billing-api/entities/plan.entity';
import { withDashes } from '@/datasources/billing-api/upstream-customer-id.util';

export type Subscription = z.infer<typeof SubscriptionSchema>;

export const SubscriptionStatuses = [
  'active',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'past_due',
  'paused',
  'trialing',
  'unpaid',
] as const;

export const SubscriptionStatusSchema = z.enum(SubscriptionStatuses);

export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const SubscriptionStatusFilterSchema = z.enum([
  ...SubscriptionStatuses,
  'all',
]);

export type SubscriptionStatusFilter = z.infer<
  typeof SubscriptionStatusFilterSchema
>;

export const SubscriptionSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  upstreamCustomerId: z.string().transform(withDashes),
  plan: SubscriptionPlanSchema,
  status: SubscriptionStatusSchema,
  createdAt: z.number(),
  startAt: z.number(),
  cancelledAt: z.number().nullable(),
  cancelAt: z.number().nullable(),
  validUntil: z.number().nullish(),
  metadata: StripeMetadataSchema.nullish(),
});
