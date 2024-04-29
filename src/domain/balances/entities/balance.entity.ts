import { BalanceTokenSchema } from '@/domain/balances/entities/balance.token.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export type NativeBalance = z.infer<typeof NativeBalanceSchema>;

export type Erc20Balance = z.infer<typeof Erc20BalanceSchema>;

export type Balance = z.infer<typeof BalanceSchema>;

export const NativeBalanceSchema = z.object({
  // Likely `null` but for safety we allow optional defaulting
  tokenAddress: z.null().optional().default(null),
  token: z.null().optional().default(null),
  balance: z.string(),
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
