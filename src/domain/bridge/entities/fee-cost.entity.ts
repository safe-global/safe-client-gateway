import { z } from 'zod';
import { TokenSchema } from '@/domain/bridge/entities/token.entity';

export const FeeCostSchema = z.object({
  name: z.string(),
  description: z.string(),
  percentage: z.string(),
  token: TokenSchema,
  amount: z.string(),
  amountUSD: z.string(),
  included: z.boolean(),
});

export type FeeCost = z.infer<typeof FeeCostSchema>;
