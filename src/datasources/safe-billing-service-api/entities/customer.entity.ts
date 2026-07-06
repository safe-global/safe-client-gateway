// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export type Customer = z.infer<typeof CustomerSchema>;

// Only the fields CGW needs to link a Space to a billing customer.
// The upstream CustomerInfoDto also carries Stripe profile PII
// (email, address, taxId, companyName, name, customerType) that no
// CGW consumer (PLA-1643/PLA-1722) needs, so it's deliberately not modeled here.
export const CustomerSchema = z.object({
  id: z.string(),
  upstreamCustomerId: z.string(),
  customerGroup: z.string(),
});
