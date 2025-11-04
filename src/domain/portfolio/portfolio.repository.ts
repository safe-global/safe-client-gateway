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
import { getNumberString } from '@/domain/common/utils/utils';

/**
 * Portfolio repository.
 * Handles caching, filtering (chainIds, trusted, excludeDust), and aggregation.
 * Filters are applied after fetching from the API.
 */
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

  /**
   * Clears cached portfolio for an address.
   *
   * @param args - Clear parameters
   */
  async clearPortfolio(args: { address: Address }): Promise<void> {
    await this.cacheService.deleteByKey(
      CacheRouter.getPortfolioCacheKey({
        address: args.address,
      }),
    );
  }

  /**
   * Applies filters to portfolio.
   *
   * @param portfolio - Portfolio to filter
   * @param args - Filter options
   */
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

  /**
   * Filters portfolio using token and position filter functions.
   * Used by other filter functions (_filterByChains, _filterTrustedTokens, _filterDustPositions).
   *
   * @param portfolio - Portfolio to filter
   * @param tokenFilter - Filter function for tokens
   * @param positionFilter - Filter function for positions
   */
  private _filterPortfolio(
    portfolio: Portfolio,
    tokenFilter: (token: TokenBalance) => boolean,
    positionFilter: (position: AppPosition) => boolean,
  ): Portfolio {
    const filteredTokenBalances = portfolio.tokenBalances.filter(tokenFilter);

    const filteredAppBalances = portfolio.positionBalances
      .map((app) => this._filterAppBalance(app, positionFilter))
      .filter((app): app is NonNullable<typeof app> => app !== null);

    return this._recalculateTotals(filteredTokenBalances, filteredAppBalances);
  }

  /**
   * Filters positions within an app balance, removing empty groups.
   *
   * @param app - App balance to filter
   * @param positionFilter - Filter function for positions
   * @returns Filtered app balance or null if all groups are empty
   */
  private _filterAppBalance(
    app: AppBalance,
    positionFilter: (position: AppPosition) => boolean,
  ): AppBalance | null {
    const filteredGroups = app.groups
      .map((group) => {
        const filteredItems = group.items.filter(positionFilter);
        if (filteredItems.length === 0) return null;
        return {
          ...group,
          items: filteredItems,
        };
      })
      .filter((group): group is NonNullable<typeof group> => group !== null);

    if (filteredGroups.length === 0) return null;

    const allFilteredPositions = filteredGroups.flatMap((group) => group.items);
    const sum = this._sumBalances(allFilteredPositions);

    return {
      ...app,
      groups: filteredGroups,
      balanceFiat: getNumberString(sum),
    };
  }

  /**
   * Filters portfolio by chain IDs.
   *
   * @param portfolio - Portfolio to filter
   * @param chainIds - Chain IDs to include
   */
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

  /**
   * Filters portfolio to only include trusted tokens and positions.
   *
   * @param portfolio - Portfolio to filter
   */
  private _filterTrustedTokens(portfolio: Portfolio): Portfolio {
    return this._filterPortfolio(
      portfolio,
      (token) => token.tokenInfo.trusted,
      (position) => position.tokenInfo.trusted,
    );
  }

  /**
   * Filters out dust positions below threshold.
   *
   * @param portfolio - Portfolio to filter
   */
  private _filterDustPositions(portfolio: Portfolio): Portfolio {
    const isDustFree = (item: { balanceFiat?: string }): boolean => {
      if (!item.balanceFiat) return true;
      const value = Number(item.balanceFiat);
      return value >= this.dustThresholdUsd;
    };

    return this._filterPortfolio(portfolio, isDustFree, isDustFree);
  }

  /**
   * Sums fiat balances from items.
   *
   * @param items - Items with balanceFiat property
   */
  private _sumBalances(items: Array<{ balanceFiat?: string }>): number {
    return items.reduce((sum, item) => {
      const value = item.balanceFiat ? Number(item.balanceFiat) : 0;
      return sum + value;
    }, 0);
  }

  /**
   * Recalculates total balances from filtered token and app balances.
   *
   * @param tokenBalances - Filtered token balances
   * @param appBalances - Filtered app balances
   */
  private _recalculateTotals(
    tokenBalances: Array<TokenBalance>,
    appBalances: Array<AppBalance>,
  ): Portfolio {
    const totalTokenBalanceFiat = this._sumBalances(tokenBalances);
    const totalPositionsBalanceFiat = this._sumBalances(appBalances);

    return {
      totalBalanceFiat: getNumberString(
        totalTokenBalanceFiat + totalPositionsBalanceFiat,
      ),
      totalTokenBalanceFiat: getNumberString(totalTokenBalanceFiat),
      totalPositionsBalanceFiat: getNumberString(totalPositionsBalanceFiat),
      tokenBalances,
      positionBalances: appBalances,
    };
  }
}
