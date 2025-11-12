import { Module } from '@nestjs/common';
import type { Address } from 'viem';
import type { Portfolio } from '@/modules/portfolio/domain/entities/portfolio.entity';
import { PortfolioService } from '@/modules/portfolio/domain/portfolio.service';
import { PortfolioRepositoryModule } from '@/modules/portfolio/domain/portfolio.repository.module';

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
