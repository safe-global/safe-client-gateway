import { z } from 'zod';

export type BalanceToken = z.infer<typeof BalanceTokenSchema>;

export const BalanceTokenSchema = z.object({
  name: z.string(),
  symbol: z.string(),
  decimals: z.number(),
  logoUri: z.string(),
});
