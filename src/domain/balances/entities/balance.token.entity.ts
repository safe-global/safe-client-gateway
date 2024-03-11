import { BalanceTokenSchema } from '@/domain/balances/entities/schemas/balance.schema';
import { z } from 'zod';

export type BalanceToken = z.infer<typeof BalanceTokenSchema>;
