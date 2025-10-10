import { z } from 'zod';
import { TokenBalancesSchema } from '@/domain/portfolio/entities/token-balance.entity';
import { AppBalancesSchema } from '@/domain/portfolio/entities/app-balance.entity';

export const PortfolioSchema = z.object({
  totalBalanceFiat: z.string(),
  totalTokenBalanceFiat: z.string(),
  totalPositionsBalanceFiat: z.string(),
  tokenBalances: TokenBalancesSchema,
  positionBalances: AppBalancesSchema,
});

export type Portfolio = z.infer<typeof PortfolioSchema>;
