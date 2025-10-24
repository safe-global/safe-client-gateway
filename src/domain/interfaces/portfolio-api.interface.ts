import type { Address } from 'viem';
import type { Raw } from '@/validation/entities/raw.entity';
import type { Portfolio } from '@/domain/portfolio/entities/portfolio.entity';
import type { ZerionBalance } from '@/datasources/balances-api/entities/zerion-balance.entity';
import type { PnL } from '@/domain/portfolio/entities/pnl.entity';

export const IPortfolioApi = Symbol('IPortfolioApi');

export interface IPortfolioApi {
  /**
   * Retrieves the portfolio data for a given wallet address.
   *
   * @param args.address - The wallet address
   * @param args.fiatCode - The fiat currency code (e.g., 'USD', 'EUR')
   * @param args.chainIds - Optional array of chain IDs to filter by
   * @param args.trusted - Optional flag to filter trusted tokens only
   * @param args.fungibleIds - Optional array of fungible IDs to filter PnL by
   * @returns A promise that resolves to the portfolio data
   */
  getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds?: Array<string>;
    trusted?: boolean;
    fungibleIds?: Array<string>;
  }): Promise<Raw<Portfolio>>;

  /**
   * Fetches position balances for a wallet (optional method for provider-specific APIs).
   */
  fetchPositions?(args: {
    address: Address;
    fiatCode: string;
    trusted?: boolean;
  }): Promise<Array<ZerionBalance>>;

  /**
   * Fetches PnL data for a wallet (optional method for provider-specific APIs).
   */
  fetchPnL?(args: {
    address: Address;
    fiatCode: string;
    fungibleIds?: Array<string>;
  }): Promise<PnL>;
}
