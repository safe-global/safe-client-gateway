// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export type Customer = z.infer<typeof CustomerSchema>;

// Only the fields CGW needs to link a Space to a billing customer.
export const CustomerSchema = z.object({
  id: z.string(),
  upstreamCustomerId: z.string(),
  customerGroup: z.string(),
});
