// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { buildLenientPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

/**
 * `Operation` of the `PolicyConfirmed` event.
 *
 * The names are CGW's wire format; the Transaction Service serializes the
 * on-chain numeric value instead (`0` CALL, `1` DELEGATECALL), so it is mapped
 * on the way in by {@link PolicyOperationSchema} and back on the way out by
 * `operationValue`.
 *
 * @see https://github.com/safe-research/policy-engine
 */
export const PolicyOperation = {
  Call: 'CALL',
  DelegateCall: 'DELEGATECALL',
} as const;

export type PolicyOperation =
  (typeof PolicyOperation)[keyof typeof PolicyOperation];

/**
 * The Transaction Service's `operation` (an `IntegerField` mirroring the
 * contract enum), mapped to {@link PolicyOperation}.
 *
 * An unknown value fails the confirmation rather than defaulting to `CALL`:
 * silently downgrading a DELEGATECALL policy to a CALL one would misreport what
 * the Safe is actually restricted to.
 */
export const PolicyOperationSchema = z
  .union([z.literal(0), z.literal(1)])
  .transform((value) =>
    value === 1 ? PolicyOperation.DelegateCall : PolicyOperation.Call,
  );

/**
 * The `data` blob of a `PolicyConfirmed` event, decoded by the Transaction
 * Service.
 *
 * `parameters` is intentionally left unvalidated here: only the policy contract
 * knows its layout, so each policy resolver validates the shape it understands
 * (see `domain/resolvers`). This keeps an unknown - or newly added - policy from
 * failing the whole page.
 */
export const PolicyDataDecodedSchema = z.object({
  policyName: z.string(),
  parameters: z.unknown(),
});

export type PolicyDataDecoded = z.infer<typeof PolicyDataDecodedSchema>;

/**
 * A `PolicyConfirmed` event indexed by the Transaction Service.
 *
 * @see WA-2911 `GET /api/v2/safes/{address}/policy-confirmations/`
 */
export const PolicyConfirmationSchema = z.object({
  safe: AddressSchema,
  guard: AddressSchema,
  /** `NULL_ADDRESS` for a fallback (catch-all) policy. */
  target: AddressSchema,
  /** 4-byte function selector, `0x00000000` for a fallback policy. */
  selector: HexSchema,
  operation: PolicyOperationSchema,
  /** `NULL_ADDRESS` when the policy was removed for this access. */
  policy: AddressSchema,
  /**
   * Name of the policy contract deployed at {@link policy}, as registered in
   * the Transaction Service's `PolicyContract` table. `null` when the address
   * is not a known policy there, which is always the case on a removal.
   *
   * Kept unconstrained: the registry carries policies CGW does not model
   * (`AllowPolicy`, `DenyPolicy`, …) and can gain more without a CGW release,
   * so an unrecognised name must not fail the confirmation.
   */
  policyType: z.string().nullish().default(null),
  removed: z.boolean(),
  fallback: z.boolean(),
  data: HexSchema.nullish().default(null),
  dataDecoded: PolicyDataDecodedSchema.nullish().default(null),
  transactionHash: HexSchema,
  blockNumber: z.number(),
  logIndex: z.number(),
  timestamp: z.coerce.date(),
});

export type PolicyConfirmation = z.infer<typeof PolicyConfirmationSchema>;

export const PolicyConfirmationPageSchema = buildLenientPageSchema(
  PolicyConfirmationSchema,
);
