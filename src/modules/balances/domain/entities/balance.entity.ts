import { BalanceTokenSchema } from '@/modules/balances/domain/entities/balance.token.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';
import { NullableStringSchema } from '@/validation/entities/schemas/nullable.schema';

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

export const FiatSchema = z.object({
  fiatBalance: NullableStringSchema,
  fiatBalance24hChange: z.coerce.string().nullish().default(null),
  fiatConversion: NullableStringSchema,
});

export const BalanceSchema = z.union([
  NativeBalanceSchema.extend(FiatSchema.shape),
  Erc20BalanceSchema.extend(FiatSchema.shape),
]);

export const BalancesSchema = z.array(BalanceSchema);
