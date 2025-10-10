import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IPortfolioRepository } from '@/domain/portfolio/portfolio.repository.interface';
import { IPortfolioApi } from '@/domain/interfaces/portfolio-api.interface';
import {
  Portfolio,
  PortfolioSchema,
} from '@/domain/portfolio/entities/portfolio.entity';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  ZERION_PORTFOLIO_API,
  ZAPPER_PORTFOLIO_API,
} from '@/datasources/portfolio-api/portfolio-api.module';

@Injectable()
export class PortfolioRepository implements IPortfolioRepository {
  private readonly cacheExpirationSeconds = 5;

  constructor(
    @Inject(IPortfolioApi) private readonly defaultPortfolioApi: IPortfolioApi,
    @Inject(ZERION_PORTFOLIO_API)
    private readonly zerionPortfolioApi: IPortfolioApi,
    @Inject(ZAPPER_PORTFOLIO_API)
    private readonly zapperPortfolioApi: IPortfolioApi,
    @Inject(CacheService) private readonly cacheService: ICacheService,
  ) {}

  async getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds?: Array<string>;
    trusted?: boolean;
    excludeDust?: boolean;
    provider?: string;
  }): Promise<Portfolio> {
    const provider = args.provider?.toLowerCase() || 'zerion';
    const cacheDir = CacheRouter.getPortfolioCacheDir({
      address: args.address,
      fiatCode: args.fiatCode,
      provider,
    });

    const cached = await this.cacheService.hGet(cacheDir);
    if (cached) {
      return PortfolioSchema.parse(JSON.parse(cached));
    }

    const portfolioApi = this._getProviderApi(provider);
    const portfolio = await portfolioApi.getPortfolio({
      address: args.address,
      fiatCode: args.fiatCode,
      chainIds: args.chainIds,
    });

    let filteredPortfolio = PortfolioSchema.parse(portfolio);

    if (args.excludeDust) {
      filteredPortfolio = this._filterDustPositions(filteredPortfolio);
    }

    await this.cacheService.hSet(
      cacheDir,
      JSON.stringify(filteredPortfolio),
      this.cacheExpirationSeconds,
    );

    return filteredPortfolio;
  }

  async clearPortfolio(args: { address: Address }): Promise<void> {
    // Clear cache for both providers
    const zerionKey = CacheRouter.getPortfolioCacheKey({
      address: args.address,
      provider: 'zerion',
    });
    const zapperKey = CacheRouter.getPortfolioCacheKey({
      address: args.address,
      provider: 'zapper',
    });
    await Promise.all([
      this.cacheService.deleteByKey(zerionKey),
      this.cacheService.deleteByKey(zapperKey),
    ]);
  }

  private _getProviderApi(provider: string): IPortfolioApi {
    switch (provider) {
      case 'zapper':
        return this.zapperPortfolioApi;
      case 'zerion':
      default:
        return this.zerionPortfolioApi;
    }
  }

  private _filterDustPositions(portfolio: Portfolio): Portfolio {
    const DUST_THRESHOLD_USD = 1;

    const filteredTokenBalances = portfolio.tokenBalances.filter((token) => {
      if (!token.balanceFiat) return true;
      return parseFloat(token.balanceFiat) >= DUST_THRESHOLD_USD;
    });

    const filteredAppBalances = portfolio.positionBalances
      .map((app) => {
        const filteredPositions = app.positions.filter((position) => {
          if (!position.balanceFiat) return true;
          return parseFloat(position.balanceFiat) >= DUST_THRESHOLD_USD;
        });

        if (filteredPositions.length === 0) return null;

        const appBalanceFiat = filteredPositions
          .reduce((sum, pos) => {
            return sum + parseFloat(pos.balanceFiat ?? '0');
          }, 0)
          .toString();

        return {
          ...app,
          positions: filteredPositions,
          balanceFiat: appBalanceFiat,
        };
      })
      .filter((app): app is NonNullable<typeof app> => app !== null);

    const totalBalanceFiat = (
      filteredTokenBalances.reduce(
        (sum, token) => sum + parseFloat(token.balanceFiat ?? '0'),
        0,
      ) +
      filteredAppBalances.reduce(
        (sum, app) => sum + parseFloat(app.balanceFiat ?? '0'),
        0,
      )
    ).toString();

    const totalTokenBalanceFiat = filteredTokenBalances
      .reduce((sum, token) => sum + parseFloat(token.balanceFiat ?? '0'), 0)
      .toString();

    const totalPositionsBalanceFiat = filteredAppBalances
      .reduce((sum, app) => sum + parseFloat(app.balanceFiat ?? '0'), 0)
      .toString();

    return {
      totalBalanceFiat,
      totalTokenBalanceFiat,
      totalPositionsBalanceFiat,
      tokenBalances: filteredTokenBalances,
      positionBalances: filteredAppBalances,
    };
  }
}
