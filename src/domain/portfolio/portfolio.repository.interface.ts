import { Module } from '@nestjs/common';
import type { Address } from 'viem';
import type { Portfolio } from '@/domain/portfolio/entities/portfolio.entity';
import { PortfolioRepository } from '@/domain/portfolio/portfolio.repository';
import { PortfolioApiModule } from '@/datasources/portfolio-api/portfolio-api.module';

export const IPortfolioRepository = Symbol('IPortfolioRepository');

export interface IPortfolioRepository {
  getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds?: Array<string>;
    trusted?: boolean;
    excludeDust?: boolean;
    provider?: string;
  }): Promise<Portfolio>;

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
