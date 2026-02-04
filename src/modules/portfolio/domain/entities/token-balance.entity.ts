import { z } from 'zod';
import { NullableAddressSchema } from '@/validation/entities/schemas/nullable.schema';

const FiatStringSchema = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/);
const PercentageStringSchema = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/);

export const TokenBalanceTokenInfoSchema = z.object({
  address: NullableAddressSchema,
  decimals: z.number(),
  symbol: z.string(),
  name: z.string(),
  logoUri: z.string(),
  chainId: z.string(),
  trusted: z.boolean(),
  type: z.enum(['ERC20', 'NATIVE_TOKEN']),
});

export const TokenBalanceSchema = z.object({
  tokenInfo: TokenBalanceTokenInfoSchema,
  balance: z.string(),
  balanceFiat: FiatStringSchema.optional(),
  price: FiatStringSchema.optional(),
  priceChangePercentage1d: PercentageStringSchema.optional(),
});

export const TokenBalancesSchema = z.array(TokenBalanceSchema);

export type TokenBalanceTokenInfo = z.infer<typeof TokenBalanceTokenInfoSchema>;
export type TokenBalance = z.infer<typeof TokenBalanceSchema>;
export type TokenBalances = z.infer<typeof TokenBalancesSchema>;
