import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IPortfolioService as DomainPortfolioService } from '@/domain/portfolio/portfolio.service.interface';
import { Portfolio } from '@/routes/portfolio/entities/portfolio.entity';
import { mapToApiPortfolio } from '@/routes/portfolio/portfolio.mapper';

@Injectable()
export class PortfolioService {
  constructor(
    @Inject(DomainPortfolioService)
    private readonly domainPortfolioService: DomainPortfolioService,
  ) {}

  async getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds?: Array<string>;
    trusted?: boolean;
    excludeDust?: boolean;
    provider?: string;
  }): Promise<Portfolio> {
    const domainPortfolio =
      await this.domainPortfolioService.getPortfolio(args);
    return mapToApiPortfolio(domainPortfolio);
  }

  async clearPortfolio(args: { address: Address }): Promise<void> {
    await this.domainPortfolioService.clearPortfolio(args);
  }
}
