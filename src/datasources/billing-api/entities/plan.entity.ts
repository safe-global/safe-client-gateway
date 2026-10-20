// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { StripeMetadataSchema } from '#/datasources/billing-api/entities/metadata.entity';

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
  metadata: StripeMetadataSchema,
  name: z.string(),
});

// Strings, not enums: billing adds currencies, cycles and tiers without a gateway release.
const BasePlanSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  description: z.string().nullish(),
  currentPrice: z.number(),
  originalPrice: z.number().nullable(),
  paymentMethod: z.string(),
  currency: z.string(),
  features: z.array(z.string()),
  billingCycle: z.string().nullish(),
  type: z.string(),
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
