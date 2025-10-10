import { Module } from '@nestjs/common';
import type { Address } from 'viem';
import type { Portfolio } from '@/domain/portfolio/entities/portfolio.entity';
import { PortfolioService } from '@/domain/portfolio/portfolio.service';
import { PortfolioRepositoryModule } from '@/domain/portfolio/portfolio.repository.interface';

export const IPortfolioService = Symbol('IPortfolioService');

export interface IPortfolioService {
  getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds?: Array<string>;
    trusted?: boolean;
    excludeDust?: boolean;
  }): Promise<Portfolio>;

  clearPortfolio(args: { address: Address }): Promise<void>;
}

@Module({
  imports: [PortfolioRepositoryModule],
  providers: [
    {
      provide: IPortfolioService,
      useClass: PortfolioService,
    },
  ],
  exports: [IPortfolioService],
})
export class PortfolioServiceModule {}
