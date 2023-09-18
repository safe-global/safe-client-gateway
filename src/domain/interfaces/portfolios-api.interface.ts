import { Portfolio } from '../portfolios/entities/portfolio.entity';
import { Position } from '../portfolios/entities/position.entity';

export const IPortfoliosApi = Symbol('IPortfoliosApi');

export interface IPortfoliosApi {
  getPositions(args: {
    chainName: string;
    safeAddress: string;
    currency: string;
  }): Promise<Position[]>;

  getPortfolio(args: {
    safeAddress: string;
    currency: string;
  }): Promise<Portfolio>;

  clearPortfolio(args: { safeAddress: string }): Promise<void>;
}
