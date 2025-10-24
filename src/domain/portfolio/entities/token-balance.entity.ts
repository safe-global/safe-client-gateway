import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { AssetIdSchema } from '@/domain/common/entities/asset-identifier.entity';

export const TokenBalanceTokenInfoSchema = z.object({
  address: AddressSchema.nullish().default(null),
  decimals: z.number(),
  symbol: z.string(),
  name: z.string(),
  logoUrl: z.string().nullish().default(null),
  chainId: z.string(),
  trusted: z.boolean(),
  assetId: AssetIdSchema,
});

export const TokenBalanceSchema = z.object({
  tokenInfo: TokenBalanceTokenInfoSchema,
  balance: z.string(),
  balanceFiat: z.number().nullish().default(null),
  price: z.number().nullish().default(null),
  priceChangePercentage1d: z.number().nullish().default(null),
});

export const TokenBalancesSchema = z.array(TokenBalanceSchema);

export type TokenBalanceTokenInfo = z.infer<typeof TokenBalanceTokenInfoSchema>;
export type TokenBalance = z.infer<typeof TokenBalanceSchema>;
export type TokenBalances = z.infer<typeof TokenBalancesSchema>;
