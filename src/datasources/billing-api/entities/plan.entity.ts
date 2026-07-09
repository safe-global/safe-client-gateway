// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export type Plan = z.infer<typeof PlanSchema>;

export const PlanSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  currentPrice: z.number(),
  originalPrice: z.number(),
  paymentMethod: z.literal('fiat'),
  currency: z.enum(['usd', 'eur']),
  features: z.array(z.string()),
  billingCycle: z.enum(['monthly', 'yearly']).nullable(),
  type: z.enum(['standard', 'premium', 'enterprise']),
});
