import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';

export const DefiVaultStatsProtocols = [
  'aave_v3',
  'compound_v3',
  'venus',
] as const;

export const DefiVaultStatsChains = [
  'eth',
  'arb',
  'bsc',
  'matic',
  'op',
] as const;

export const DefiVaultStatsSchema = z.object({
  asset: AddressSchema,
  asset_icon: z.string().url(),
  asset_symbol: z.string(),
  share_symbol: z.string(),
  tvl: NumericStringSchema,
  protocol: z.enum([...DefiVaultStatsProtocols, 'unknown']).catch('unknown'),
  protocol_icon: z.string().url(),
  protocol_tvl: NumericStringSchema,
  protocol_supply_limit: NumericStringSchema,
  grr: z.number(),
  nrr: z.number(),
  vault: AddressSchema,
  chain: z.enum([...DefiVaultStatsChains, 'unknown']).catch('unknown'),
  chain_id: z.number(),
  asset_decimals: z.number(),
  updated_at_block: z.number(),
});

export type DefiVaultStats = z.infer<typeof DefiVaultStatsSchema>;
