// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

/**
 * Upper bound for one batch lookup. The web app's popular list is at most 8
 * tokens per chain, so 20 leaves headroom without inviting amplification.
 *
 * Read together with `tokens.rateLimit.max`: the two multiply into the
 * worst-case upstream fan-out per caller per window. Tightening that ceiling
 * is a rate-limit change, not a change here, because this bound is part of
 * the published API contract and is interpolated into the OpenAPI schema.
 */
export const MAX_TOKEN_ADDRESSES = 20;

/**
 * `?addresses=0x…,0x…` → checksummed addresses in request order.
 * Empty, malformed or more than MAX_TOKEN_ADDRESSES entries fail validation (422).
 * Duplicates are kept here; the service collapses them.
 */
export const TokenAddressesSchema = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  )
  .pipe(z.array(AddressSchema).min(1).max(MAX_TOKEN_ADDRESSES));

export type TokenAddresses = z.infer<typeof TokenAddressesSchema>;
