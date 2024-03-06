import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const NativeBalanceSchema = z.object({
  tokenAddress: z.null(),
  token: z.null(),
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
  fiatBalance: z.string().nullable(),
  fiatConversion: z.string().nullable(),
});

export const BalanceSchema = z.union([
  NativeBalanceSchema.merge(FiatSchema),
  Erc20BalanceSchema.merge(FiatSchema),
]);
