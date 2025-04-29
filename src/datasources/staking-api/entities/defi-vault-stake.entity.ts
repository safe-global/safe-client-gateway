import { z } from 'zod';
import { DefiVaultStatsSchema } from '@/datasources/staking-api/entities/defi-vault-stats.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

export const DefiVaultStakeSchema = z.object({
  vault_id: z.string(),
  owner: AddressSchema,
  current_balance: NumericStringSchema,
  shares_balance: NumericStringSchema,
  total_rewards: NumericStringSchema,
  current_rewards: NumericStringSchema,
  total_deposited_amount: NumericStringSchema,
  total_withdrawn_amount: NumericStringSchema,
  vault: AddressSchema,
  chain: DefiVaultStatsSchema.shape.chain,
  chain_id: z.number(),
  updated_at_block: z.number(),
});

export const DefiVaultStakesSchema = z.array(DefiVaultStakeSchema);

export type DefiVaultStake = z.infer<typeof DefiVaultStakeSchema>;
