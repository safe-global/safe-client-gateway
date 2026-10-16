// SPDX-License-Identifier: FSL-1.1-MIT
import { size } from 'viem';
import { z } from 'zod';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';
import { HexBytesSchema } from '#/validation/entities/schemas/hexbytes.schema';

/** Bytes of a function selector. */
const SELECTOR_SIZE = 4;

/** Largest `data` of one configuration CGW stores, in bytes. */
export const MAX_POLICY_CONFIGURATION_DATA_BYTES = 65_536;

/**
 * Most configurations one request may carry. The guard sets no limit; this
 * keeps `applyConfiguration` well within one transaction and bounds DB writes.
 * A constant, not config: it is part of the API wallets build against.
 */
export const MAX_POLICY_CONFIGURATIONS_PER_REQUEST = 100;

/**
 * One `Configuration` of `SafePolicyGuard`, stored exactly as hashed so it
 * reproduces the root. Hex must be whole bytes: ABI encoding pads odd lengths.
 */
export const PolicyConfigurationSchema = z.object({
  target: AddressSchema,
  selector: HexBytesSchema.refine((value) => size(value) === SELECTOR_SIZE, {
    error: `Invalid selector, expected ${SELECTOR_SIZE} bytes`,
  }),
  operation: z.enum(Operation),
  /** `NULL_ADDRESS` removes the policy of this access. */
  policy: AddressSchema,
  /** The policy payload, abi-encoded as passed to the guard. */
  data: HexBytesSchema.refine(
    (value) => size(value) <= MAX_POLICY_CONFIGURATION_DATA_BYTES,
    {
      error: `Invalid data, exceeds the maximum of ${MAX_POLICY_CONFIGURATION_DATA_BYTES} bytes`,
    },
  ),
});

export type PolicyConfiguration = z.infer<typeof PolicyConfigurationSchema>;

/** The `Configuration[]` of one request; never empty. */
export const PolicyConfigurationsSchema = z
  .array(PolicyConfigurationSchema)
  .nonempty()
  .max(MAX_POLICY_CONFIGURATIONS_PER_REQUEST, {
    error: `Invalid configurations, exceeds the maximum of ${MAX_POLICY_CONFIGURATIONS_PER_REQUEST}`,
  });
