import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import type { Portfolio } from '@/modules/portfolio/domain/entities/portfolio.entity';
import { IPortfolioRepository } from '@/modules/portfolio/domain/portfolio.repository.interface';
import type { IPortfolioService } from '@/modules/portfolio/domain/portfolio.service.interface';

/**
 * Domain portfolio service.
 * Delegates to PortfolioRepository for data retrieval.
 */
@Injectable()
export class PortfolioService implements IPortfolioService {
  constructor(
    @Inject(IPortfolioRepository)
    private readonly portfolioRepository: IPortfolioRepository,
  ) {}

  public getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds?: Array<string>;
    trusted?: boolean;
    excludeDust?: boolean;
    isTestnet?: boolean;
    sync?: boolean;
  }): Promise<Portfolio> {
    return this.portfolioRepository.getPortfolio(args);
  }

  public async clearPortfolio(args: { address: Address }): Promise<void> {
    await this.portfolioRepository.clearPortfolio(args);
  }
}
