import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IPortfolioService as DomainPortfolioService } from '@/domain/portfolio/portfolio.service.interface';
import { Portfolio } from '@/routes/portfolio/entities/portfolio.entity';
import { PortfolioMapper } from '@/routes/portfolio/portfolio.mapper';

@Injectable()
export class PortfolioService {
  constructor(
    @Inject(DomainPortfolioService)
    private readonly domainPortfolioService: DomainPortfolioService,
    private readonly portfolioMapper: PortfolioMapper,
  ) {}

  async getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds?: Array<string>;
    trusted?: boolean;
    excludeDust?: boolean;
  }): Promise<Portfolio> {
    const domainPortfolio =
      await this.domainPortfolioService.getPortfolio(args);
    return this.portfolioMapper.mapZerionPortfolioToApi(domainPortfolio);
  }

  async clearPortfolio(args: { address: Address }): Promise<void> {
    await this.domainPortfolioService.clearPortfolio(args);
  }
}
