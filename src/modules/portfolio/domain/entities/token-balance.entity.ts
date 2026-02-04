import { z } from 'zod';
import {
  FiatStringSchema,
  TokenInfoSchema,
} from '@/modules/portfolio/domain/entities/token-info.entity';

export const TokenBalanceSchema = z.object({
  tokenInfo: TokenInfoSchema,
  balance: z.string(),
  balanceFiat: FiatStringSchema.optional(),
  price: FiatStringSchema.optional(),
  priceChangePercentage1d: FiatStringSchema.optional(),
});

export const TokenBalancesSchema = z.array(TokenBalanceSchema);

export type TokenBalance = z.infer<typeof TokenBalanceSchema>;
export type TokenBalances = z.infer<typeof TokenBalancesSchema>;
