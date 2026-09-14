// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { ChainIdSchema } from '@/modules/chains/domain/entities/schemas/chain-id.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

/**
 * A Safe as every policy route addresses one: a chain and an address.
 *
 * `chainId` is a decimal string, as everywhere in CGW. Policy state is per Safe
 * per chain, and a Space can hold the same address on two chains with different
 * policies on each - so the pair travels together and is never collapsed to one
 * half.
 */
export const SafeRefSchema = z.object({
  chainId: ChainIdSchema,
  address: AddressSchema,
});

export type SafeRef = z.infer<typeof SafeRefSchema>;
