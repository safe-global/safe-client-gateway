import type { Address } from 'viem';
import type { Raw } from '@/validation/entities/raw.entity';
import type { Portfolio } from '@/domain/portfolio/entities/portfolio.entity';

export const IPortfolioApi = Symbol('IPortfolioApi');

export interface IPortfolioApi {
  getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds?: Array<string>;
    trusted?: boolean;
  }): Promise<Raw<Portfolio>>;
}
