import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IPortfolioService as DomainPortfolioService } from '@/domain/portfolio/portfolio.service.interface';
import type { Portfolio as DomainPortfolio } from '@/domain/portfolio/entities/portfolio.entity';
import { Portfolio } from '@/routes/portfolio/entities/portfolio.entity';
import { NULL_ADDRESS } from '@/routes/common/constants';

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
    const domainPortfolio = await this.domainPortfolioService.getPortfolio(
      args,
    );
    return this._mapToApiPortfolio(domainPortfolio);
  }

  async clearPortfolio(args: { address: Address }): Promise<void> {
    await this.domainPortfolioService.clearPortfolio(args);
  }

  private _mapToApiPortfolio(domainPortfolio: DomainPortfolio): Portfolio {
    return {
      totalBalanceFiat: domainPortfolio.totalBalanceFiat,
      totalTokenBalanceFiat: domainPortfolio.totalTokenBalanceFiat,
      totalPositionsBalanceFiat: domainPortfolio.totalPositionsBalanceFiat,
      tokenBalances: domainPortfolio.tokenBalances.map((token) => ({
        tokenInfo: {
          address: token.tokenInfo.address ?? NULL_ADDRESS,
          decimals: token.tokenInfo.decimals,
          symbol: token.tokenInfo.symbol,
          name: token.tokenInfo.name,
          logoUrl: token.tokenInfo.logoUrl,
          chainId: token.tokenInfo.chainId,
          trusted: token.tokenInfo.trusted,
        },
        balance: token.balance,
        balanceFiat: token.balanceFiat,
        price: token.price,
        priceChangePercentage1d: token.priceChangePercentage1d,
      })),
      positionBalances: domainPortfolio.positionBalances.map((app) => ({
        appInfo: {
          name: app.appInfo.name,
          logoUrl: app.appInfo.logoUrl,
          url: app.appInfo.url,
        },
        balanceFiat: app.balanceFiat,
        positions: app.positions.map((position) => ({
          key: position.key,
          type: position.type,
          name: position.name,
          tokenInfo: {
            address: position.tokenInfo.address ?? NULL_ADDRESS,
            decimals: position.tokenInfo.decimals,
            symbol: position.tokenInfo.symbol,
            name: position.tokenInfo.name,
            logoUrl: position.tokenInfo.logoUrl,
            chainId: position.tokenInfo.chainId,
            trusted: position.tokenInfo.trusted,
          },
          balance: position.balance,
          balanceFiat: position.balanceFiat,
          priceChangePercentage1d: position.priceChangePercentage1d,
        })),
      })),
    };
  }
}
