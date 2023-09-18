import { Portfolio } from './entities/portfolio.entity';
import { Position } from './entities/position.entity';

export const IPortfoliosRepository = Symbol('IPortfoliosRepository');

export interface IPortfoliosRepository {
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
