import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const NativeBalanceSchema = z.object({
  // Likely `null` but for safety we allow optional defaulting
  tokenAddress: z.null().optional().default(null),
  token: z.null().optional().default(null),
  balance: z.string(),
});

export const BalanceTokenSchema = z.object({
  name: z.string(),
  symbol: z.string(),
  decimals: z.number(),
  logoUri: z.string(),
});

export const Erc20BalanceSchema = z.object({
  tokenAddress: AddressSchema,
  token: BalanceTokenSchema,
  balance: z.string(),
});

const FiatSchema = z.object({
  fiatBalance: z.string().nullish().default(null),
  fiatConversion: z.string().nullish().default(null),
});

export const BalanceSchema = z.union([
  NativeBalanceSchema.merge(FiatSchema),
  Erc20BalanceSchema.merge(FiatSchema),
]);
