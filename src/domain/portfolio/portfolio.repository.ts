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
  private readonly positionsCacheExpirationSeconds = 30;
  private readonly pnlCacheExpirationSeconds = 60;

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
    fungibleIds?: Array<string>;
  }): Promise<Portfolio> {
    const provider = args.provider?.toLowerCase() || 'zerion';
    const portfolioApi = this._getProviderApi(provider);

    // Use separate caching strategy for Zerion (which supports PnL)
    // For Zapper, use single cache since it doesn't support PnL
    if (provider === 'zerion') {
      const portfolio = await this._getZerionPortfolioWithSeparateCaching(
        args,
        portfolioApi,
      );
      return this._applyFilters(portfolio, args);
    } else {
      // Zapper: use original single cache strategy
      const portfolio = await this._getPortfolioWithSingleCache(
        args,
        portfolioApi,
        provider,
      );
      return this._applyFilters(portfolio, args);
    }
  }

  private async _getZerionPortfolioWithSeparateCaching(
    args: {
      address: Address;
      fiatCode: string;
      trusted?: boolean;
      fungibleIds?: Array<string>;
    },
    portfolioApi: any,
  ): Promise<Portfolio> {
    const positionsCacheDir = CacheRouter.getPortfolioPositionsCacheDir({
      address: args.address,
      fiatCode: args.fiatCode,
      provider: 'zerion',
    });

    const pnlCacheDir = CacheRouter.getPortfolioPnLCacheDir({
      address: args.address,
      fiatCode: args.fiatCode,
      fungibleIds: args.fungibleIds,
    });

    // Check cache first
    const [cachedPortfolio, cachedPnL] = await Promise.all([
      this.cacheService.hGet(positionsCacheDir),
      this.cacheService.hGet(pnlCacheDir),
    ]);

    // If both are cached, return combined result
    if (cachedPortfolio && cachedPnL) {
      const portfolio = JSON.parse(cachedPortfolio);
      const pnl = JSON.parse(cachedPnL);
      return PortfolioSchema.parse({ ...portfolio, pnl });
    }

    // If only portfolio is cached but PnL expired, fetch PnL separately
    if (cachedPortfolio && !cachedPnL) {
      const portfolio = JSON.parse(cachedPortfolio);
      let pnl = null;
      try {
        pnl = await portfolioApi.fetchPnL({
          address: args.address,
          fiatCode: args.fiatCode,
          fungibleIds: args.fungibleIds,
        });
        await this.cacheService.hSet(
          pnlCacheDir,
          JSON.stringify(pnl),
          this.pnlCacheExpirationSeconds,
        );
      } catch (error) {
        // PnL fetch failed, continue with null
        pnl = null;
      }
      return PortfolioSchema.parse({ ...portfolio, pnl });
    }

    // Otherwise, fetch everything fresh (portfolio API handles parallel fetching)
    const rawPortfolio = await portfolioApi.getPortfolio({
      address: args.address,
      fiatCode: args.fiatCode,
      trusted: args.trusted,
      fungibleIds: args.fungibleIds,
    });

    const portfolio = PortfolioSchema.parse(rawPortfolio);

    // Cache positions and PnL separately
    const { pnl, ...portfolioWithoutPnL } = portfolio;
    await Promise.all([
      this.cacheService.hSet(
        positionsCacheDir,
        JSON.stringify(portfolioWithoutPnL),
        this.positionsCacheExpirationSeconds,
      ),
      pnl
        ? this.cacheService.hSet(
            pnlCacheDir,
            JSON.stringify(pnl),
            this.pnlCacheExpirationSeconds,
          )
        : Promise.resolve(),
    ]);

    return portfolio;
  }

  private async _getPortfolioWithSingleCache(
    args: {
      address: Address;
      fiatCode: string;
      trusted?: boolean;
    },
    portfolioApi: any,
    provider: string,
  ): Promise<Portfolio> {
    const cacheDir = CacheRouter.getPortfolioCacheDir({
      address: args.address,
      fiatCode: args.fiatCode,
      provider,
    });

    const cached = await this.cacheService.hGet(cacheDir);

    if (cached) {
      return PortfolioSchema.parse(JSON.parse(cached));
    }

    const rawPortfolio = await portfolioApi.getPortfolio({
      address: args.address,
      fiatCode: args.fiatCode,
      trusted: args.trusted,
    });

    const portfolio = PortfolioSchema.parse(rawPortfolio);

    await this.cacheService.hSet(
      cacheDir,
      JSON.stringify(portfolio),
      this.positionsCacheExpirationSeconds,
    );

    return portfolio;
  }

  private _applyFilters(
    portfolio: Portfolio,
    args: {
      chainIds?: Array<string>;
      trusted?: boolean;
      excludeDust?: boolean;
    },
  ): Portfolio {
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
    // Clear old single-cache keys
    const zerionKey = CacheRouter.getPortfolioCacheKey({
      address: args.address,
      provider: 'zerion',
    });
    const zapperKey = CacheRouter.getPortfolioCacheKey({
      address: args.address,
      provider: 'zapper',
    });

    // Clear new separate cache keys for Zerion
    const zerionPositionsKey = CacheRouter.getPortfolioPositionsCacheKey({
      address: args.address,
      provider: 'zerion',
    });
    const zerionPnLKey = CacheRouter.getPortfolioPnLCacheKey({
      address: args.address,
    });

    await Promise.all([
      this.cacheService.deleteByKey(zerionKey),
      this.cacheService.deleteByKey(zapperKey),
      this.cacheService.deleteByKey(zerionPositionsKey),
      this.cacheService.deleteByKey(zerionPnLKey),
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
      pnl: portfolio.pnl, // Preserve PnL through filtering
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
      pnl: portfolio.pnl, // Preserve PnL through filtering
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
      pnl: portfolio.pnl, // Preserve PnL through filtering
    };
  }
}
