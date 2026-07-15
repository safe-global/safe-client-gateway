// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export const PlanCurrencies = ['usd', 'eur'] as const;

export const PlanBillingCycles = ['month', 'year'] as const;

export const PlanTypes = ['standard', 'premium', 'enterprise'] as const;

export type MarketingFeature = z.infer<typeof MarketingFeatureSchema>;

export const MarketingFeatureSchema = z.object({
  name: z.string(),
});

export type Product = z.infer<typeof ProductSchema>;

export const ProductSchema = z.object({
  id: z.string(),
  active: z.boolean(),
  description: z.string(),
  marketingFeatures: z.array(MarketingFeatureSchema),
  // Generic, like Stripe metadata itself: see PaymentLinkMetadataSchema.
  metadata: z.record(z.string(), z.string()),
  name: z.string(),
});

const BasePlanSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  description: z.string().nullish(),
  currentPrice: z.number(),
  originalPrice: z.number().nullable(),
  paymentMethod: z.literal('fiat'),
  currency: z.enum(PlanCurrencies),
  features: z.array(z.string()),
  billingCycle: z.enum(PlanBillingCycles).nullish(),
  type: z.enum(PlanTypes),
});

export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;

// As embedded in a Subscription: the product is referenced by ID only.
export const SubscriptionPlanSchema = BasePlanSchema.extend({
  product: z.string().nullable(),
});

export type Plan = z.infer<typeof PlanSchema>;

// As returned by GET /plans and GET /plans/{planId}: the full product object.
export const PlanSchema = BasePlanSchema.extend({
  product: ProductSchema,
});
