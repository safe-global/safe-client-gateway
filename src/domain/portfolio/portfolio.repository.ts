import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IPortfolioRepository } from '@/domain/portfolio/portfolio.repository.interface';
import { IPortfolioApi } from '@/domain/interfaces/portfolio-api.interface';
import {
  Portfolio,
  PortfolioSchema,
} from '@/domain/portfolio/entities/portfolio.entity';
import type { TokenBalance } from '@/domain/portfolio/entities/token-balance.entity';
import type { AppBalance } from '@/domain/portfolio/entities/app-balance.entity';
import type { AppPosition } from '@/domain/portfolio/entities/app-position.entity';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Injectable()
export class PortfolioRepository implements IPortfolioRepository {
  private readonly cacheExpirationSeconds: number;
  private readonly dustThresholdUsd: number;

  constructor(
    @Inject(IPortfolioApi) private readonly portfolioApi: IPortfolioApi,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.cacheExpirationSeconds = this.configurationService.getOrThrow<number>(
      'portfolio.cache.ttlSeconds',
    );
    this.dustThresholdUsd = this.configurationService.getOrThrow<number>(
      'portfolio.filters.dustThresholdUsd',
    );
  }

  async getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds?: Array<string>;
    trusted?: boolean;
    excludeDust?: boolean;
  }): Promise<Portfolio> {
    const cacheDir = CacheRouter.getPortfolioCacheDir({
      address: args.address,
      fiatCode: args.fiatCode,
    });

    const cached = await this.cacheService.hGet(cacheDir);
    let portfolio: Portfolio;

    if (cached) {
      portfolio = PortfolioSchema.parse(JSON.parse(cached));
    } else {
      const rawPortfolio = await this.portfolioApi.getPortfolio({
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

    return this._applyFilters(portfolio, args);
  }

  async clearPortfolio(args: { address: Address }): Promise<void> {
    await this.cacheService.deleteByKey(
      CacheRouter.getPortfolioCacheKey({
        address: args.address,
      }),
    );
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
      filteredPortfolio = this._filterByChains(
        filteredPortfolio,
        args.chainIds,
      );
    }

    if (args.trusted) {
      filteredPortfolio = this._filterTrustedTokens(filteredPortfolio);
    }

    if (args.excludeDust) {
      filteredPortfolio = this._filterDustPositions(filteredPortfolio);
    }

    return filteredPortfolio;
  }

  private _filterPortfolio(
    portfolio: Portfolio,
    tokenPredicate: (token: TokenBalance) => boolean,
    positionPredicate: (position: AppPosition) => boolean,
  ): Portfolio {
    const filteredTokenBalances =
      portfolio.tokenBalances.filter(tokenPredicate);

    const filteredAppBalances = portfolio.positionBalances
      .map((app) => {
        const filteredPositions = app.positions.filter(positionPredicate);

        if (filteredPositions.length === 0) return null;

        return {
          ...app,
          positions: filteredPositions,
          balanceFiat: this._sumBalances(filteredPositions),
        };
      })
      .filter((app): app is NonNullable<typeof app> => app !== null);

    return this._recalculateTotals(filteredTokenBalances, filteredAppBalances);
  }

  private _filterByChains(
    portfolio: Portfolio,
    chainIds: Array<string>,
  ): Portfolio {
    const chainIdSet = new Set(chainIds);
    return this._filterPortfolio(
      portfolio,
      (token) => chainIdSet.has(token.tokenInfo.chainId),
      (position) => chainIdSet.has(position.tokenInfo.chainId),
    );
  }

  private _filterTrustedTokens(portfolio: Portfolio): Portfolio {
    return this._filterPortfolio(
      portfolio,
      (token) => token.tokenInfo.trusted,
      (position) => position.tokenInfo.trusted,
    );
  }

  private _filterDustPositions(portfolio: Portfolio): Portfolio {
    const isDustFree = (item: { balanceFiat: number | null }): boolean =>
      !item.balanceFiat || item.balanceFiat >= this.dustThresholdUsd;

    return this._filterPortfolio(portfolio, isDustFree, isDustFree);
  }

  private _sumBalances(items: Array<{ balanceFiat: number | null }>): number {
    return items.reduce((sum, item) => sum + (item.balanceFiat ?? 0), 0);
  }

  private _recalculateTotals(
    tokenBalances: Array<TokenBalance>,
    appBalances: Array<AppBalance>,
  ): Portfolio {
    const totalTokenBalanceFiat = this._sumBalances(tokenBalances);
    const totalPositionsBalanceFiat = this._sumBalances(appBalances);

    return {
      totalBalanceFiat: totalTokenBalanceFiat + totalPositionsBalanceFiat,
      totalTokenBalanceFiat,
      totalPositionsBalanceFiat,
      tokenBalances,
      positionBalances: appBalances,
    };
  }
}
