import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IPortfolioService as DomainPortfolioService } from '@/domain/portfolio/portfolio.service.interface';
import type { Portfolio as DomainPortfolio } from '@/domain/portfolio/entities/portfolio.entity';
import { Portfolio } from '@/routes/portfolio/entities/portfolio.entity';
import { PnL } from '@/routes/portfolio/entities/pnl.entity';
import { WalletChart } from '@/routes/portfolio/entities/wallet-chart.entity';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { IChartsRepository } from '@/domain/charts/charts.repository.interface';
import { ChartPeriod } from '@/domain/charts/entities/chart.entity';

@Injectable()
export class PortfolioService {
  constructor(
    @Inject(DomainPortfolioService)
    private readonly domainPortfolioService: DomainPortfolioService,
    @Inject(IChartsRepository)
    private readonly chartsRepository: IChartsRepository,
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

  async getWalletChart(args: {
    address: Address;
    period: ChartPeriod;
    currency: string;
  }): Promise<WalletChart> {
    const domainChart = await this.chartsRepository.getWalletChart(args);
    return new WalletChart(domainChart);
  }

  async clearWalletChart(args: {
    address: Address;
    period: ChartPeriod;
    currency: string;
  }): Promise<void> {
    await this.chartsRepository.clearWalletChart(args);
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
          logoUri: token.tokenInfo.logoUri,
          chainId: token.tokenInfo.chainId,
          trusted: token.tokenInfo.trusted,
          assetId: token.tokenInfo.assetId,
          type: token.tokenInfo.type,
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
            logoUri: position.tokenInfo.logoUri,
            chainId: position.tokenInfo.chainId,
            trusted: position.tokenInfo.trusted,
            assetId: position.tokenInfo.assetId,
            type: position.tokenInfo.type,
          },
          balance: position.balance,
          balanceFiat: position.balanceFiat,
          priceChangePercentage1d: position.priceChangePercentage1d,
        })),
      })),
      pnl: domainPortfolio.pnl ? new PnL(domainPortfolio.pnl) : null,
    };
  }
}
