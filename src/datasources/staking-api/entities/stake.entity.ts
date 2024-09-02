import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';

export const StakeSchema = z.object({
  // Note: validator_address would be a 96 character hexadecimal string.
  validator_address: z.string(),
  state: z.string(),
  effective_balance: NumericStringSchema,
  rewards: NumericStringSchema,
});

export type Stake = z.infer<typeof StakeSchema>;
