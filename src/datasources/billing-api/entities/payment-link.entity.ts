// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export type PaymentLinkPriceRecurring = z.infer<
  typeof PaymentLinkPriceRecurringSchema
>;

export const PaymentLinkPriceRecurringSchema = z.object({
  interval: z.string(),
  intervalCount: z.number(),
});

export type PaymentLinkPrice = z.infer<typeof PaymentLinkPriceSchema>;

export const PaymentLinkPriceSchema = z.object({
  id: z.string(),
  unitAmount: z.unknown().optional(),
  currency: z.string().optional(),
  recurring: PaymentLinkPriceRecurringSchema.optional(),
  product: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
});

export type PaymentLinkLineItem = z.infer<typeof PaymentLinkLineItemSchema>;

export const PaymentLinkLineItemSchema = z.object({
  price: PaymentLinkPriceSchema,
  quantity: z.number(),
});

export type PaymentLinkMetadata = z.infer<typeof PaymentLinkMetadataSchema>;

export const PaymentLinkMetadataSchema = z.object({
  customerGroup: z.string().optional(),
  upstreamCustomerId: z.string().optional(),
});

export type PaymentLink = z.infer<typeof PaymentLinkSchema>;

export const PaymentLinkSchema = z.object({
  id: z.string(),
  url: z.string(),
  active: z.boolean(),
  metadata: PaymentLinkMetadataSchema,
  customText: z.record(z.string(), z.unknown()).optional(),
  afterCompletion: z.record(z.string(), z.unknown()).optional(),
  lineItems: z.array(PaymentLinkLineItemSchema).optional(),
});
