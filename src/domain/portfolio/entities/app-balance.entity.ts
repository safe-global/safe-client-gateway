import { z } from 'zod';
import { AppPositionGroupsSchema } from '@/domain/portfolio/entities/app-position.entity';

const FiatStringSchema = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/);

export const AppBalanceAppInfoSchema = z.object({
  name: z.string(),
  logoUrl: z.string().optional(),
  url: z.string().optional(),
});

export const AppBalanceSchema = z.object({
  appInfo: AppBalanceAppInfoSchema,
  balanceFiat: FiatStringSchema,
  groups: AppPositionGroupsSchema,
});

export const AppBalancesSchema = z.array(AppBalanceSchema);

export type AppBalanceAppInfo = z.infer<typeof AppBalanceAppInfoSchema>;
export type AppBalance = z.infer<typeof AppBalanceSchema>;
export type AppBalances = z.infer<typeof AppBalancesSchema>;
