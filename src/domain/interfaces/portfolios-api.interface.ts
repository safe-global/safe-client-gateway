import { PortfolioResponse } from '../portfolios/entities/portfolio.entity';
import { PositionsResponse } from '../portfolios/entities/position.entity';

export const IPortfoliosApi = Symbol('IPortfoliosApi');

export interface IPortfoliosApi {
  getPositions(args: {
    chainName: string;
    safeAddress: string;
    currency: string;
  }): Promise<PositionsResponse>;

  getPortfolio(args: {
    safeAddress: string;
    currency: string;
  }): Promise<PortfolioResponse>;

  clearPortfolio(args: { safeAddress: string }): Promise<void>;
}
