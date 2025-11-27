import type { Address } from 'viem';
import type { Raw } from '@/validation/entities/raw.entity';
import type { Portfolio } from '@/modules/portfolio/domain/entities/portfolio.entity';

export const IPortfolioApi = Symbol('IPortfolioApi');

export interface IPortfolioApi {
  /**
   * Retrieves the portfolio data for a given wallet address.
   *
   * @param {Object} args - Portfolio fetch parameters
   * @param {Address} args.address - The wallet address
   * @param {string} args.fiatCode - The fiat currency code (e.g., 'USD', 'EUR')
   * @param {Array<string>} [args.chainIds] - Optional array of chain IDs to filter by
   * @param {boolean} [args.trusted] - Optional flag to filter trusted tokens only
   * @param {boolean} [args.isTestnet] - Optional flag to indicate testnet chains
   * @param {boolean} [args.sync] - Optional flag to wait for data aggregation
   * @returns {Promise<Raw<Portfolio>>} A promise that resolves to the portfolio data
   */
  getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds?: Array<string>;
    trusted?: boolean;
    isTestnet?: boolean;
    sync?: boolean;
  }): Promise<Raw<Portfolio>>;
}
