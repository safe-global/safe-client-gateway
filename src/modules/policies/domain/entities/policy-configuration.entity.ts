// SPDX-License-Identifier: FSL-1.1-MIT
import { size } from 'viem';
import { z } from 'zod';
import {
  operationValue,
  PolicyOperation,
} from '@/modules/policies/domain/entities/policy-operation.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

/** Bytes of a function selector. */
const SELECTOR_SIZE = 4;

/**
 * One entry of the `Configuration[]` a delayed configuration request hashes.
 *
 * ```solidity
 * struct Configuration { address target; bytes4 selector; Operation operation; address policy; bytes data; }
 * ```
 *
 * Stored exactly as it was hashed - `data` raw, never decoded - because the
 * stored form has to reproduce the on-chain root.
 */
export const PolicyConfigurationSchema = z.object({
  target: AddressSchema,
  selector: HexSchema.refine((value) => size(value) === SELECTOR_SIZE, {
    error: 'Invalid selector, expected 4 bytes',
  }),
  /**
   * Serialized as the on-chain numeric value, matching how the Transaction
   * Service serializes `PolicyConfirmed.operation`.
   */
  operation: z
    .union([
      z.literal(operationValue(PolicyOperation.Call)),
      z.literal(operationValue(PolicyOperation.DelegateCall)),
    ])
    .describe('0 = CALL, 1 = DELEGATECALL'),
  /** `NULL_ADDRESS` removes the policy of this access. */
  policy: AddressSchema,
  data: HexSchema,
});

export type PolicyConfiguration = z.infer<typeof PolicyConfigurationSchema>;

/**
 * The `Configuration[]` of one request. Empty arrays are rejected: a request
 * that configures nothing has no meaning, and would hash to a root no wallet
 * flow can produce.
 */
export const PolicyConfigurationsSchema = z
  .array(PolicyConfigurationSchema)
  .nonempty();
