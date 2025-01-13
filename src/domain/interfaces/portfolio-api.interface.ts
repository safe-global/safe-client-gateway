import type { Portfolio } from '@/domain/portfolio/entities/portfolio.entity';
import type { Raw } from '@/validation/entities/raw.entity';

export const IPortfolioApi = Symbol('IPortfolioApi');

export interface IPortfolioApi {
  getPortfolio(safeAddress: `0x${string}`): Promise<Raw<Portfolio>>;
}
