// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { ChainIdSchema } from '@/modules/chains/domain/entities/schemas/chain-id.schema';
import { PolicyConfigurationsSchema } from '@/modules/policies/domain/entities/policy-configuration.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

/**
 * The configurations CGW stored for one root of one Safe.
 *
 * Only a decoding aid: the on-chain `RootConfigured` and `RootInvalidated`
 * events decide where a root stands.
 */
export const StoredPolicyConfigurationSchema = z.object({
  chainId: ChainIdSchema,
  safeAddress: AddressSchema,
  root: HexSchema,
  configurations: PolicyConfigurationsSchema,
  createdAt: z.date(),
});

export type StoredPolicyConfiguration = z.infer<
  typeof StoredPolicyConfigurationSchema
>;
