// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

/**
 * How a plan change is billed. A constant, not a field: the upstream accepts
 * an override, and a caller who could pick `none` would get a plan change
 * nobody is invoiced for.
 */
export const DEFAULT_PRORATION_BEHAVIOR = 'always_invoice';

export type PreviewLineItem = z.infer<typeof PreviewLineItemSchema>;

export const PreviewLineItemSchema = z.object({
  description: z.string(),
  /** Signed minor units: negative for credit on unused time. */
  amount: z.number(),
  currency: z.string(),
});

export type SubscriptionUpdatePreview = z.infer<
  typeof SubscriptionUpdatePreviewSchema
>;

export const SubscriptionUpdatePreviewSchema = z.object({
  amountDue: z.number(),
  currency: z.string(),
  /** Unix seconds, as everywhere else on a subscription. */
  nextBillingDate: z.number(),
  lineItems: z.array(PreviewLineItemSchema),
});

export type UpdateSubscriptionResult = z.infer<
  typeof UpdateSubscriptionResultSchema
>;

export const UpdateSubscriptionResultSchema = z.object({
  subscriptionId: z.string(),
  success: z.boolean(),
});
