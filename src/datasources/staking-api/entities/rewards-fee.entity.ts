import { z } from 'zod';

export const RewardsFeeSchema = z.object({
  fee: z.number().nullish().default(0),
});

export type RewardsFee = z.infer<typeof RewardsFeeSchema>;
