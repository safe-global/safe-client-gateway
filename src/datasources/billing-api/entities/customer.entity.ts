// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { withDashes } from '@/datasources/billing-api/upstream-customer-id.util';

export type Customer = z.infer<typeof CustomerSchema>;

// Only the fields CGW needs to link a Space to a billing customer.
export const CustomerSchema = z.object({
  id: z.string(),
  upstreamCustomerId: z.string().transform(withDashes),
  customerGroup: z.string(),
});
