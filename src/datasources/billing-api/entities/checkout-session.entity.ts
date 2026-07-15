// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

// Field names intentionally mirror the upstream billing-service wire format
// (snake_case) rather than being remapped to camelCase, since this schema is
// a near-verbatim pass-through of the upstream checkout session object.
export type CheckoutSession = z.infer<typeof CheckoutSessionSchema>;

export const CheckoutSessionSchema = z.object({
  id: z.string(),
  object: z.string(),
  amount_subtotal: z.number(),
  amount_total: z.number(),
  cancel_url: z.string(),
  client_reference_id: z.string().nullish(),
  created: z.number(),
  currency: z.string(),
  customer: z.string().nullish(),
  expires_at: z.number(),
  metadata: z.record(z.string(), z.unknown()),
  mode: z.string(),
  payment_status: z.string(),
  status: z.string(),
  success_url: z.string(),
  url: z.string(),
  subscription: z.string().nullish(),
  invoice: z.string().nullish(),
});

// Response of POST /payment-links/{id}/checkout — not the full session object above.
export type CheckoutSessionResult = z.infer<typeof CheckoutSessionResultSchema>;

export const CheckoutSessionResultSchema = z.object({
  sessionId: z.string(),
  url: z.string(),
});
