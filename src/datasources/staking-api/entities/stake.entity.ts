import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';

export const StakeSchema = z.object({
  validator_address: z.string(),
  validator_index: z.number(),
  state: z.string(),
  activated_at: z.coerce.date(),
  activated_epoch: z.number(),
  delegated_block: z.number(),
  delegated_at: z.coerce.date(),
  effective_balance: NumericStringSchema,
  balance: NumericStringSchema,
  consensus_rewards: NumericStringSchema,
  execution_rewards: NumericStringSchema,
  rewards: NumericStringSchema,
  gross_apy: z.number(),
  deposit_tx_sender: AddressSchema,
  withdrawal_credentials: z.string(),
  is_kiln: z.boolean(),
  activation_eligibility_epoch: z.number(),
  activation_eligibility_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  estimated_next_skimming_slot: z.number(),
  estimated_next_skimming_at: z.coerce.date(),
});

export type Stake = z.infer<typeof StakeSchema>;

// TODO: schema tests
