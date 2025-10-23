/* Minimal types for fields actually used from simulation.assets_diffs (Blockaid) */

import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

const AssetTypeSchema = z.enum(['NATIVE', 'ERC20', 'ERC721', 'ERC1155']);

const AssetDetailsSchema = z.object({
  type: AssetTypeSchema,
  symbol: z.string().optional(),
  address: AddressSchema,
  logo_url: z.string().optional(),
});

const FungibleDiffSchema = z.object({
  value: z.string().optional(),
});

const NFTDiffSchema = z.object({
  token_id: z.number(),
});

const AssetDiffSchema = z.union([NFTDiffSchema, FungibleDiffSchema]);

export const BalanceChangeSchema = z.object({
  asset: AssetDetailsSchema,
  in: z.array(AssetDiffSchema),
  out: z.array(AssetDiffSchema),
});

export const BalanceChangesSchema = z.array(BalanceChangeSchema);
export type BalanceChanges = z.infer<typeof BalanceChangesSchema>;
