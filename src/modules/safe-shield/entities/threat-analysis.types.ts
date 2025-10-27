/* Minimal types for fields actually used from simulation.assets_diffs (Blockaid) */

import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export const AssetTypeSchema = z.enum(['NATIVE', 'ERC20', 'ERC721', 'ERC1155']);
export type AssetType = z.infer<typeof AssetTypeSchema>;

const BaseAssetDetailsSchema = z.object({
  symbol: z.string().optional(),
  logo_url: z.string().optional(),
});

export const AssetDetailsSchema = z.discriminatedUnion('type', [
  BaseAssetDetailsSchema.extend({
    type: z.literal('NATIVE'),
  }),
  BaseAssetDetailsSchema.extend({
    type: z.enum(['ERC20', 'ERC721', 'ERC1155']),
    address: AddressSchema,
  }),
]);
export type AssetDetails = z.infer<typeof AssetDetailsSchema>;

export const FungibleDiffSchema = z.object({
  value: z.string().optional(),
});

export const NFTDiffSchema = z.object({
  token_id: HexSchema.transform(Number),
});

export const AssetDiffSchema = z.union([NFTDiffSchema, FungibleDiffSchema]);

export const BalanceChangeSchema = z.object({
  asset: AssetDetailsSchema,
  in: z.array(AssetDiffSchema),
  out: z.array(AssetDiffSchema),
});

export type BalanceChange = z.infer<typeof BalanceChangeSchema>;
export const BalanceChangesSchema = z.array(BalanceChangeSchema);
