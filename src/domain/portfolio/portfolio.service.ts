import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IPortfolioService } from '@/domain/portfolio/portfolio.service.interface';
import { IPortfolioRepository } from '@/domain/portfolio/portfolio.repository.interface';
import type { Portfolio } from '@/domain/portfolio/entities/portfolio.entity';

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

  async getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds?: Array<string>;
    trusted?: boolean;
    excludeDust?: boolean;
  }): Promise<Portfolio> {
    return this.portfolioRepository.getPortfolio(args);
  }

  async clearPortfolio(args: { address: Address }): Promise<void> {
    await this.portfolioRepository.clearPortfolio(args);
  }
}
