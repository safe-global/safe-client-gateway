import { z } from 'zod';
import { TokenBalancesSchema } from '@/domain/portfolio/entities/token-balance.entity';
import { AppBalancesSchema } from '@/domain/portfolio/entities/app-balance.entity';
import { PnLSchema } from '@/domain/portfolio/entities/pnl.entity';

export const PortfolioSchema = z.object({
  totalBalanceFiat: z.number(),
  totalTokenBalanceFiat: z.number(),
  totalPositionsBalanceFiat: z.number(),
  tokenBalances: TokenBalancesSchema,
  positionBalances: AppBalancesSchema,
  pnl: PnLSchema,
});

export type Portfolio = z.infer<typeof PortfolioSchema>;
