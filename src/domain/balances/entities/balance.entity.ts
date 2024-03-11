import {
  BalanceSchema,
  Erc20BalanceSchema,
  NativeBalanceSchema,
} from '@/domain/balances/entities/schemas/balance.schema';
import { z } from 'zod';

export type NativeBalance = z.infer<typeof NativeBalanceSchema>;

export type Erc20Balance = z.infer<typeof Erc20BalanceSchema>;

export type Balance = z.infer<typeof BalanceSchema>;
