// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { Portfolio } from '#/modules/portfolio/domain/entities/portfolio.entity';
import type {
  PortfolioSnapshot,
  PortfolioSnapshotArgs,
} from '#/modules/portfolio/domain/entities/portfolio-snapshot.entity';

export const IPortfolioRepository = Symbol('IPortfolioRepository');

export interface IPortfolioRepository {
  /**
   * Retrieves the portfolio data for a given wallet address with optional filtering.
   *
   * @param {Object} args - Portfolio fetch parameters
   * @param {Address} args.address - The wallet address
   * @param {string} args.fiatCode - The fiat currency code (e.g., 'USD', 'EUR')
   * @param {Array<string>} [args.chainIds] - Optional array of chain IDs to filter by
   * @param {boolean} [args.trusted] - Optional flag to filter trusted tokens only
   * @param {boolean} [args.excludeDust] - Optional flag to exclude dust (very small value) positions
   * @param {boolean} [args.isTestnet] - Optional flag to indicate testnet chains
   * @param {boolean} [args.sync] - Optional flag to wait for data aggregation
   * @returns {Promise<Portfolio>} A promise that resolves to the portfolio data
   */
  getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds?: Array<string>;
    trusted?: boolean;
    excludeDust?: boolean;
    isTestnet?: boolean;
    sync?: boolean;
  }): Promise<Portfolio>;

  /**
   * Gets the cached portfolio GET /v1/portfolio serves, with the trusted and
   * dust filters applied and the entry's fetch and expiry times. A miss
   * spends the shared Zerion budget before fetching.
   *
   * @param {Object} args - Snapshot parameters
   * @param {Address} args.address - The wallet address
   * @param {string} args.fiatCode - The fiat currency code (e.g., 'USD', 'EUR')
   * @param {boolean} args.trusted - Whether to count trusted tokens only
   * @param {boolean} args.isTestnet - Whether to read the testnet portfolio
   * @returns {Promise<PortfolioSnapshot>} The filtered snapshot
   * @throws {LimitReachedError} On a miss when the shared Zerion budget is exhausted
   */
  getPortfolioSnapshot(args: PortfolioSnapshotArgs): Promise<PortfolioSnapshot>;

  /**
   * Clears the cached portfolio data for a given wallet address.
   *
   * @param {Object} args - Clear parameters
   * @param {Address} args.address - The wallet address
   * @returns {Promise<void>} A promise that resolves when the cache is cleared
   */
  clearZerionCaches(args: { address: Address }): Promise<void>;
}
