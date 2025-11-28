import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IPortfolioService as DomainPortfolioService } from '@/modules/portfolio/domain/portfolio.service.interface';
import { Portfolio } from '@/modules/portfolio/v1/entities/portfolio.entity';
import { PortfolioRouteMapper } from '@/modules/portfolio/v1/portfolio.mapper';
import { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';

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
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
  ) {}

  public async getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds?: Array<string>;
    trusted?: boolean;
    excludeDust?: boolean;
  }): Promise<Portfolio> {
    const isTestnet = await this._areTestnetChains(args.chainIds);
    const domainPortfolio = await this.domainPortfolioService.getPortfolio({
      ...args,
      isTestnet,
    });
    return this.portfolioRouteMapper.mapDomainToRoute(domainPortfolio);
  }

  public async clearPortfolio(args: { address: Address }): Promise<void> {
    await this.domainPortfolioService.clearPortfolio(args);
  }

  /**
   * Determines if the provided chainIds are testnet chains.
   * Returns true if chainIds are provided and ALL of them are testnets.
   * Returns false if no chainIds provided or if any chain is not a testnet.
   */
  private async _areTestnetChains(chainIds?: Array<string>): Promise<boolean> {
    if (!chainIds || chainIds.length === 0) {
      return false;
    }

    const chains = await Promise.all(
      chainIds.map((chainId) =>
        this.chainsRepository.getChain(chainId).catch(() => null),
      ),
    );

    const validChains = chains.filter((chain) => chain !== null);
    if (validChains.length === 0) {
      return false;
    }

    return validChains.every((chain) => chain.isTestnet);
  }
}
