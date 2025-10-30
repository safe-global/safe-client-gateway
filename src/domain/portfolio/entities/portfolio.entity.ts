import { z } from 'zod';
import { TokenBalancesSchema } from '@/domain/portfolio/entities/token-balance.entity';
import { AppBalancesSchema } from '@/domain/portfolio/entities/app-balance.entity';

const FiatStringSchema = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/);

export const PortfolioSchema = z.object({
  totalBalanceFiat: FiatStringSchema,
  totalTokenBalanceFiat: FiatStringSchema,
  totalPositionsBalanceFiat: FiatStringSchema,
  tokenBalances: TokenBalancesSchema,
  positionBalances: AppBalancesSchema,
});

export type Portfolio = z.infer<typeof PortfolioSchema>;
