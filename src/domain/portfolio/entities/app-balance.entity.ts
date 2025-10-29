import { z } from 'zod';
import { AppPositionsSchema } from '@/domain/portfolio/entities/app-position.entity';

export const AppBalanceAppInfoSchema = z.object({
  name: z.string(),
  logoUrl: z.string().nullish().default(null),
  url: z.string().nullish().default(null),
});

export const AppBalanceSchema = z.object({
  appInfo: AppBalanceAppInfoSchema,
  balanceFiat: z.number(),
  positions: AppPositionsSchema,
});

export const AppBalancesSchema = z.array(AppBalanceSchema);

export type AppBalanceAppInfo = z.infer<typeof AppBalanceAppInfoSchema>;
export type AppBalance = z.infer<typeof AppBalanceSchema>;
export type AppBalances = z.infer<typeof AppBalancesSchema>;
