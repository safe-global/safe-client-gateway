// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export type Plan = z.infer<typeof PlanSchema>;

export const PlanCurrencies = ['usd', 'eur'] as const;

export const PlanBillingCycles = ['monthly', 'yearly'] as const;

export const PlanTypes = ['standard', 'premium', 'enterprise'] as const;

export const PlanSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  currentPrice: z.number(),
  originalPrice: z.number(),
  paymentMethod: z.literal('fiat'),
  currency: z.enum(PlanCurrencies),
  features: z.array(z.string()),
  billingCycle: z.enum(PlanBillingCycles).nullable(),
  type: z.enum(PlanTypes),
});
