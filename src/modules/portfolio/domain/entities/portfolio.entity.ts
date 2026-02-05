import { z } from 'zod';
import { TokenBalancesSchema } from '@/modules/portfolio/domain/entities/token-balance.entity';
import { AppBalancesSchema } from '@/modules/portfolio/domain/entities/app-balance.entity';
import { FiatStringSchema } from '@/modules/portfolio/domain/entities/token-info.entity';

export const PortfolioSchema = z.object({
  totalBalanceFiat: FiatStringSchema,
  totalTokenBalanceFiat: FiatStringSchema,
  totalPositionsBalanceFiat: FiatStringSchema,
  tokenBalances: TokenBalancesSchema,
  positionBalances: AppBalancesSchema,
});

export type Portfolio = z.infer<typeof PortfolioSchema>;
