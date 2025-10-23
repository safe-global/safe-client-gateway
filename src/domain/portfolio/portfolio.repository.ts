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
import { PortfolioProvider } from '@/domain/portfolio/entities/portfolio-provider.enum';

@Injectable()
export class PortfolioRepository implements IPortfolioRepository {
  private readonly cacheExpirationSeconds = 30;

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
    const provider =
      args.provider?.toLowerCase() || PortfolioProvider.ZERION;
    const cacheDir = CacheRouter.getPortfolioCacheDir({
      address: args.address,
      fiatCode: args.fiatCode,
      provider,
    });

    const cached = await this.cacheService.hGet(cacheDir);
    let portfolio: Portfolio;

    if (cached) {
      portfolio = PortfolioSchema.parse(JSON.parse(cached));
    } else {
      const portfolioApi = this._getProviderApi(provider);
      const rawPortfolio = await portfolioApi.getPortfolio({
        address: args.address,
        fiatCode: args.fiatCode,
        trusted: args.trusted,
      });

      portfolio = PortfolioSchema.parse(rawPortfolio);

      await this.cacheService.hSet(
        cacheDir,
        JSON.stringify(portfolio),
        this.cacheExpirationSeconds,
      );
    }

    let filteredPortfolio = portfolio;

    if (args.chainIds && args.chainIds.length > 0) {
      filteredPortfolio = this._filterByChains(filteredPortfolio, args.chainIds);
    }

    if (args.trusted) {
      filteredPortfolio = this._filterTrustedTokens(filteredPortfolio);
    }

    if (args.excludeDust) {
      filteredPortfolio = this._filterDustPositions(filteredPortfolio);
    }

    return filteredPortfolio;
  }

  async clearPortfolio(args: { address: Address }): Promise<void> {
    const zerionKey = CacheRouter.getPortfolioCacheKey({
      address: args.address,
      provider: PortfolioProvider.ZERION,
    });
    const zapperKey = CacheRouter.getPortfolioCacheKey({
      address: args.address,
      provider: PortfolioProvider.ZAPPER,
    });
    await Promise.all([
      this.cacheService.deleteByKey(zerionKey),
      this.cacheService.deleteByKey(zapperKey),
    ]);
  }

  private _getProviderApi(provider: string): IPortfolioApi {
    switch (provider) {
      case PortfolioProvider.ZAPPER:
        return this.zapperPortfolioApi;
      case PortfolioProvider.ZERION:
      default:
        return this.zerionPortfolioApi;
    }
  }

  private _filterByChains(
    portfolio: Portfolio,
    chainIds: Array<string>,
  ): Portfolio {
    const chainIdSet = new Set(chainIds);

    const filteredTokenBalances = portfolio.tokenBalances.filter((token) =>
      chainIdSet.has(token.tokenInfo.chainId),
    );

    const filteredAppBalances = portfolio.positionBalances
      .map((app) => {
        const filteredPositions = app.positions.filter((position) =>
          chainIdSet.has(position.tokenInfo.chainId),
        );

        if (filteredPositions.length === 0) return null;

        const appBalanceFiat = filteredPositions.reduce((sum, pos) => {
          return sum + (pos.balanceFiat ?? 0);
        }, 0);

        return {
          ...app,
          positions: filteredPositions,
          balanceFiat: appBalanceFiat,
        };
      })
      .filter((app): app is NonNullable<typeof app> => app !== null);

    const totalTokenBalanceFiat = filteredTokenBalances.reduce(
      (sum, token) => sum + (token.balanceFiat ?? 0),
      0,
    );

    const totalPositionsBalanceFiat = filteredAppBalances.reduce(
      (sum, app) => sum + (app.balanceFiat ?? 0),
      0,
    );

    return {
      totalBalanceFiat: totalTokenBalanceFiat + totalPositionsBalanceFiat,
      totalTokenBalanceFiat,
      totalPositionsBalanceFiat,
      tokenBalances: filteredTokenBalances,
      positionBalances: filteredAppBalances,
    };
  }

  private _filterTrustedTokens(portfolio: Portfolio): Portfolio {
    const filteredTokenBalances = portfolio.tokenBalances.filter(
      (token) => token.tokenInfo.trusted,
    );

    const filteredAppBalances = portfolio.positionBalances
      .map((app) => {
        const filteredPositions = app.positions.filter(
          (position) => position.tokenInfo.trusted,
        );

        if (filteredPositions.length === 0) return null;

        const appBalanceFiat = filteredPositions.reduce((sum, pos) => {
          return sum + (pos.balanceFiat ?? 0);
        }, 0);

        return {
          ...app,
          positions: filteredPositions,
          balanceFiat: appBalanceFiat,
        };
      })
      .filter((app): app is NonNullable<typeof app> => app !== null);

    const totalBalanceFiat =
      filteredTokenBalances.reduce(
        (sum, token) => sum + (token.balanceFiat ?? 0),
        0,
      ) +
      filteredAppBalances.reduce((sum, app) => sum + (app.balanceFiat ?? 0), 0);

    const totalTokenBalanceFiat = filteredTokenBalances.reduce(
      (sum, token) => sum + (token.balanceFiat ?? 0),
      0,
    );

    const totalPositionsBalanceFiat = filteredAppBalances.reduce(
      (sum, app) => sum + (app.balanceFiat ?? 0),
      0,
    );

    return {
      totalBalanceFiat,
      totalTokenBalanceFiat,
      totalPositionsBalanceFiat,
      tokenBalances: filteredTokenBalances,
      positionBalances: filteredAppBalances,
    };
  }

  private _filterDustPositions(portfolio: Portfolio): Portfolio {
    const DUST_THRESHOLD_USD = 1;

    const filteredTokenBalances = portfolio.tokenBalances.filter((token) => {
      if (!token.balanceFiat) return true;
      return token.balanceFiat >= DUST_THRESHOLD_USD;
    });

    const filteredAppBalances = portfolio.positionBalances
      .map((app) => {
        const filteredPositions = app.positions.filter((position) => {
          if (!position.balanceFiat) return true;
          return position.balanceFiat >= DUST_THRESHOLD_USD;
        });

        if (filteredPositions.length === 0) return null;

        const appBalanceFiat = filteredPositions.reduce((sum, pos) => {
          return sum + (pos.balanceFiat ?? 0);
        }, 0);

        return {
          ...app,
          positions: filteredPositions,
          balanceFiat: appBalanceFiat,
        };
      })
      .filter((app): app is NonNullable<typeof app> => app !== null);

    const totalBalanceFiat =
      filteredTokenBalances.reduce(
        (sum, token) => sum + (token.balanceFiat ?? 0),
        0,
      ) +
      filteredAppBalances.reduce((sum, app) => sum + (app.balanceFiat ?? 0), 0);

    const totalTokenBalanceFiat = filteredTokenBalances.reduce(
      (sum, token) => sum + (token.balanceFiat ?? 0),
      0,
    );

    const totalPositionsBalanceFiat = filteredAppBalances.reduce(
      (sum, app) => sum + (app.balanceFiat ?? 0),
      0,
    );

    return {
      totalBalanceFiat,
      totalTokenBalanceFiat,
      totalPositionsBalanceFiat,
      tokenBalances: filteredTokenBalances,
      positionBalances: filteredAppBalances,
    };
  }
}
