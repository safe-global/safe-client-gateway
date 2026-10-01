// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { Origin } from '@/modules/fees/domain/entities/origin.entity';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { NonNegativeNumericStringSchema } from '@/validation/entities/schemas/non-negative-numeric-string.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

export type GtfFeesRequest = z.infer<typeof GtfFeesRequestSchema>;

/**
 * Body of the fee service's `gtf/fees` request.
 *
 * Strict: this gateway builds the body itself, so an unknown key is a mistake
 * here rather than an upstream field to tolerate, and the fee service rejects
 * one anyway.
 */
export const GtfFeesRequestSchema = z
  .object({
    to: AddressSchema,
    value: NumericStringSchema,
    data: HexSchema,
    operation: z.enum(Operation),
    numberSignatures: z.number().int().min(1),
    nonce: NonNegativeNumericStringSchema,
    gasToken: AddressSchema,
    origin: z.enum(Origin).optional(),
    /**
     * Whether the fee service must price a Safenet check.
     *
     * The user's per-transaction opt-in, forwarded only when the viewed
     * chain's `SAFENET_CHECKS` feature says the check is available — fail
     * closed, so absent, `false`, and a chain without the feature all omit it.
     *
     * Previews that disagree on the flag are safe by construction: the fee
     * service encodes the Safenet fee into `baseGas`, so the two choices are
     * different `safeTxHash`es and distinct quotes; whichever the user signs
     * is what is billed and checked.
     *
     * Sent only when true. Two assumptions about the fee service, neither
     * verifiable from this repo: absent and `false` are the same value to it,
     * and a fee service that predates the flag rejects a body carrying a field
     * its own DTO does not declare.
     */
    safenetCheck: z.boolean().optional(),
  })
  .strict();
