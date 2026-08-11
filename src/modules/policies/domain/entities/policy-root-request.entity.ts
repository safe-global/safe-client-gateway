// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { buildLenientPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

/**
 * Lifecycle of a delayed configuration request, derived by the Transaction
 * Service from the `RootConfigured`/`RootInvalidated` events.
 */
export const PolicyRootRequestStatus = {
  /** Requested, delay not yet elapsed. */
  Pending: 'pending',
  /** Delay elapsed, `applyConfiguration` can be executed. */
  Ready: 'ready',
  /** Cancelled via `invalidateRoot`. */
  Invalidated: 'invalidated',
} as const;

export type PolicyRootRequestStatus =
  (typeof PolicyRootRequestStatus)[keyof typeof PolicyRootRequestStatus];

/**
 * A `RootConfigured` event indexed by the Transaction Service.
 *
 * `validFrom` is the event's `timestamp` argument, i.e. `block.timestamp +
 * DELAY` of the guard. It is therefore authoritative and removes any need to
 * read the guard's `DELAY()` or to carry it in configuration.
 *
 * @see WA-2911 `GET /api/v2/safes/{address}/policy-root-requests/`
 */
export const PolicyRootRequestSchema = z.object({
  safe: AddressSchema,
  guard: AddressSchema,
  root: HexSchema,
  validFrom: z.coerce.date(),
  status: z.enum(PolicyRootRequestStatus),
  invalidatedAt: z.coerce.date().nullish().default(null),
  transactionHash: HexSchema,
  blockNumber: z.number(),
  logIndex: z.number(),
  timestamp: z.coerce.date(),
});

export type PolicyRootRequest = z.infer<typeof PolicyRootRequestSchema>;

export const PolicyRootRequestPageSchema = buildLenientPageSchema(
  PolicyRootRequestSchema,
);
