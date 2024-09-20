import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';

export const StakeSchema = z.object({
  validator_address: HexSchema.refine((value) => value.length === 98),
  state: z.string(),
  effective_balance: NumericStringSchema,
  rewards: NumericStringSchema,
  // Only returned if onchain_v1_include_net_rewards query is true
  net_claimable_consensus_rewards: NumericStringSchema.nullish().default(null),
});

export type Stake = z.infer<typeof StakeSchema>;
