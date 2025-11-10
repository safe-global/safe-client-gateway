import { Module } from '@nestjs/common';
import type { Address } from 'viem';
import type { Portfolio } from '@/modules/portfolio/domain/entities/portfolio.entity';
import { PortfolioRepository } from '@/modules/portfolio/domain/portfolio.repository';
import { PortfolioApiModule } from '@/modules/portfolio/datasources/portfolio-api.module';

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
   * @returns {Promise<Portfolio>} A promise that resolves to the portfolio data
   */
  getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds?: Array<string>;
    trusted?: boolean;
    excludeDust?: boolean;
  }): Promise<Portfolio>;

  /**
   * Clears the cached portfolio data for a given wallet address.
   *
   * @param {Object} args - Clear parameters
   * @param {Address} args.address - The wallet address
   * @returns {Promise<void>} A promise that resolves when the cache is cleared
   */
  clearPortfolio(args: { address: Address }): Promise<void>;
}

@Module({
  imports: [PortfolioApiModule],
  providers: [
    {
      provide: IPortfolioRepository,
      useClass: PortfolioRepository,
    },
  ],
  exports: [IPortfolioRepository],
})
export class PortfolioRepositoryModule {}
