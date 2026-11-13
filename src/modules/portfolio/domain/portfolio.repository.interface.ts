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
   * @returns {Promise<Portfolio>} A promise that resolves to the portfolio data
   */
  getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds?: Array<string>;
    trusted?: boolean;
    excludeDust?: boolean;
    isTestnet?: boolean;
  }): Promise<Portfolio>;

  /**
   * Gets the cached portfolio GET /v1/portfolio serves, with the trusted and
   * dust filters applied and the entry's fetch and expiry times.
   *
   * @param {Object} args - Snapshot parameters
   * @param {Address} args.address - The wallet address
   * @param {string} args.fiatCode - The fiat currency code (e.g., 'USD', 'EUR')
   * @param {boolean} args.trusted - Whether to count trusted tokens only
   * @param {boolean} args.isTestnet - Whether to read the testnet portfolio
   * @returns {Promise<PortfolioSnapshot>} The filtered snapshot
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

  /**
   * When the wallet's Zerion caches were last cleared, by a transaction event
   * or a refresh. The time is kept only for the post-transaction window.
   *
   * @param {Object} args - Lookup parameters
   * @param {Address} args.address - The wallet address
   * @returns {Promise<number | null>} The clear time in epoch ms, or null when
   * there was no clear within that window
   */
  getClearedAt(args: { address: Address }): Promise<number | null>;
}
