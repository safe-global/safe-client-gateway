import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IPortfolioService as DomainPortfolioService } from '@/modules/portfolio/domain/portfolio.service.interface';
import { Portfolio } from '@/modules/portfolio/v1/entities/portfolio.entity';
import { PortfolioRouteMapper } from '@/modules/portfolio/v1/portfolio.mapper';

/**
 * Portfolio API service.
 * Maps internal domain portfolio to internal API portfolio format.
 */
@Injectable()
export class PortfolioApiService {
  constructor(
    @Inject(DomainPortfolioService)
    private readonly domainPortfolioService: DomainPortfolioService,
    private readonly portfolioRouteMapper: PortfolioRouteMapper,
  ) {}

  public async getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds?: Array<string>;
    trusted?: boolean;
    excludeDust?: boolean;
  }): Promise<Portfolio> {
    const domainPortfolio =
      await this.domainPortfolioService.getPortfolio(args);
    return this.portfolioRouteMapper.mapDomainToRoute(domainPortfolio);
  }

  public async clearPortfolio(args: { address: Address }): Promise<void> {
    await this.domainPortfolioService.clearPortfolio(args);
  }
}
