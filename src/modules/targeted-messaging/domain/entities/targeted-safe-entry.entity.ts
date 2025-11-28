import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';
import type { Address } from 'viem';

/**
 * Schema for targeted safe entry that supports both legacy and chain-specific formats.
 *
 * Formats:
 * 1. Simple address string
 * 2. Object with address and chainId:
 *    { address: "0xABC...", chainId: "1" }
 */
export const TargetedSafeEntrySchema = z.union([
  AddressSchema,
  z.object({
    address: AddressSchema,
    chainId: z.string(),
  }),
]);

export type TargetedSafeEntry = Address | { address: Address; chainId: string };
