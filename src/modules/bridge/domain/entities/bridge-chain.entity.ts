// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const BridgeChainSchema = z.object({
  id: z.coerce.string(),
  diamondAddress: AddressSchema.optional(),
});

export type BridgeChain = z.infer<typeof BridgeChainSchema>;

export const BridgeChainPageSchema = z.object({
  chains: z.array(BridgeChainSchema),
});

export type BridgeChainPage = z.infer<typeof BridgeChainPageSchema>;
