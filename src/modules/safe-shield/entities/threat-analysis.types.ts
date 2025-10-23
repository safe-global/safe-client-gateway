/* Minimal types for fields actually used from simulation.assets_diffs (Blockaid) */

import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const AssetTypeSchema = z.enum(['NATIVE', 'ERC20', 'ERC721', 'ERC1155']);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const AssetDetailsSchema = z.object({
  type: AssetTypeSchema,
  symbol: z.string().optional(),
  address: AddressSchema,
  logo_url: z.string().optional(),
});
export type AssetDetails = z.infer<typeof AssetDetailsSchema>;

export const FungibleDiffSchema = z.object({
  value: z.string().optional(),
});

export const NFTDiffSchema = z.object({
  token_id: z.number(),
});

export const AssetDiffSchema = z.union([NFTDiffSchema, FungibleDiffSchema]);

export const BalanceChangeSchema = z.object({
  asset: AssetDetailsSchema,
  in: z.array(AssetDiffSchema),
  out: z.array(AssetDiffSchema),
});

export type BalanceChange = z.infer<typeof BalanceChangeSchema>;
export const BalanceChangesSchema = z.array(BalanceChangeSchema);
