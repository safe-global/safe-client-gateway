import { Module } from '@nestjs/common';
import type { Address } from 'viem';
import type { Portfolio } from '@/domain/portfolio/entities/portfolio.entity';
import { PortfolioRepository } from '@/domain/portfolio/portfolio.repository';
import { PortfolioApiModule } from '@/datasources/portfolio-api/portfolio-api.module';

export const IPortfolioRepository = Symbol('IPortfolioRepository');

export interface IPortfolioRepository {
  /**
   * Retrieves the portfolio data for a given wallet address with optional filtering.
   *
   * @param args.address - The wallet address
   * @param args.fiatCode - The fiat currency code (e.g., 'USD', 'EUR')
   * @param args.chainIds - Optional array of chain IDs to filter by
   * @param args.trusted - Optional flag to filter trusted tokens only
   * @param args.excludeDust - Optional flag to exclude dust (very small value) positions
   * @param args.provider - Optional provider name to use (e.g., 'zapper', 'zerion')
   * @returns A promise that resolves to the portfolio data
   */
  getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds?: Array<string>;
    trusted?: boolean;
    excludeDust?: boolean;
    provider?: string;
  }): Promise<Portfolio>;

  /**
   * Clears the cached portfolio data for a given wallet address.
   *
   * @param args.address - The wallet address
   * @returns A promise that resolves when the cache is cleared
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
