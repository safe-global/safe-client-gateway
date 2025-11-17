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
  'base',
] as const;

export const DefiVaultStatsAdditionalRewardSchema = z.object({
  asset: AddressSchema,
  nrr: z.number(),
});

export type DefiVaultStatsAdditionalReward = z.infer<
  typeof DefiVaultStatsAdditionalRewardSchema
>;

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
  performance_fee: z.number(),
  additional_rewards_nrr: z.number(),
  additional_rewards: z
    .array(DefiVaultStatsAdditionalRewardSchema)
    .nullish()
    .default(null),
});

export const DefiVaultsStateSchema = z.array(DefiVaultStatsSchema);

export type DefiVaultStats = z.infer<typeof DefiVaultStatsSchema>;
