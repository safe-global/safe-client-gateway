import type { Address } from 'viem';
import type { Raw } from '@/validation/entities/raw.entity';
import type { Portfolio } from '@/domain/portfolio/entities/portfolio.entity';

export const IPortfolioApi = Symbol('IPortfolioApi');

export interface IPortfolioApi {
  /**
   * Retrieves the portfolio data for a given wallet address.
   *
   * @param args.address - The wallet address
   * @param args.fiatCode - The fiat currency code (e.g., 'USD', 'EUR')
   * @param args.chainIds - Optional array of chain IDs to filter by
   * @param args.trusted - Optional flag to filter trusted tokens only
   * @returns A promise that resolves to the portfolio data
   */
  getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds?: Array<string>;
    trusted?: boolean;
  }): Promise<Raw<Portfolio>>;
}
