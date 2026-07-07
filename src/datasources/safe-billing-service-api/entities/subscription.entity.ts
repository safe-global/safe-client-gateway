// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { PlanSchema } from '@/datasources/safe-billing-service-api/entities/plan.entity';

export type Subscription = z.infer<typeof SubscriptionSchema>;

export const SubscriptionStatusSchema = z.enum([
  'active',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'past_due',
  'paused',
  'trialing',
  'unpaid',
]);

export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const SubscriptionStatusFilterSchema = z.enum([
  ...SubscriptionStatusSchema.options,
  'all',
]);

export type SubscriptionStatusFilter = z.infer<
  typeof SubscriptionStatusFilterSchema
>;

export const SubscriptionSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  upstreamCustomerId: z.string(),
  plan: PlanSchema,
  status: SubscriptionStatusSchema,
  createdAt: z.number(),
  startAt: z.number(),
  cancelledAt: z.number().nullable(),
  cancelAt: z.number().nullable(),
});
