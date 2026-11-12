// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { CacheRouter } from '#/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '#/datasources/cache/cache.service.interface';
import type { CacheDir } from '#/datasources/cache/entities/cache-dir.entity';
import { getNumberString } from '#/domain/common/utils/utils';
import type { AppBalance } from '#/modules/portfolio/domain/entities/app-balance.entity';
import type { AppPosition } from '#/modules/portfolio/domain/entities/app-position.entity';
import {
  type Portfolio,
  PortfolioSchema,
} from '#/modules/portfolio/domain/entities/portfolio.entity';
import {
  type PortfolioSnapshot,
  type PortfolioSnapshotArgs,
  PortfolioSnapshotSchema,
} from '#/modules/portfolio/domain/entities/portfolio-snapshot.entity';
import type { TokenBalance } from '#/modules/portfolio/domain/entities/token-balance.entity';
import type { IPortfolioRepository } from '#/modules/portfolio/domain/portfolio.repository.interface';
import { IPortfolioApi } from '#/modules/portfolio/interfaces/portfolio-api.interface';
import { ZerionCacheService } from '#/modules/zerion/datasources/zerion-cache.service';

/**
 * Portfolio repository.
 * Handles caching, filtering (chainIds, trusted, excludeDust), and aggregation.
 * Filters are applied after fetching from the API.
 */
/** What one portfolio fetch needs: the wallet, its filters and the cache entry to fill. */
type FetchArgs = {
  address: Address;
  fiatCode: string;
  trusted?: boolean;
  isTestnet?: boolean;
  sync?: boolean;
  cacheDir: CacheDir;
};

@Injectable()
export class PortfolioRepository implements IPortfolioRepository {
  private readonly cacheExpirationSeconds: number;
  private readonly settleSeconds: number;
  private readonly dustThresholdUsd: number;
  /** Fetches in progress in this process, by cache entry. */
  private readonly inFlightFetches = new Map<
    string,
    Promise<PortfolioSnapshot>
  >();

  constructor(
    @Inject(IPortfolioApi) private readonly portfolioApi: IPortfolioApi,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly zerionCache: ZerionCacheService,
  ) {
    this.cacheExpirationSeconds = this.configurationService.getOrThrow<number>(
      'portfolio.cache.ttlSeconds',
    );
    this.settleSeconds = this.configurationService.getOrThrow<number>(
      'portfolio.cache.settleSeconds',
    );
    this.dustThresholdUsd = this.configurationService.getOrThrow<number>(
      'portfolio.filters.dustThresholdUsd',
    );
  }

  public async getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds?: Array<string>;
    trusted?: boolean;
    excludeDust?: boolean;
    isTestnet?: boolean;
    sync?: boolean;
  }): Promise<Portfolio> {
    const cacheDir = this._getCacheDir(args);
    // If sync is true, we bypass the cache and fetch the portfolio from the API
    const cached = args.sync ? null : await this._getCached(cacheDir);
    const portfolio = PortfolioSchema.parse(
      cached ?? (await this._fetchAndCache({ ...args, cacheDir })),
    );
    return this._applyFilters(portfolio, args);
  }

  public async getPortfolioSnapshot(
    args: PortfolioSnapshotArgs,
  ): Promise<PortfolioSnapshot> {
    const cacheDir = this._getCacheDir(args);
    const cached = PortfolioSnapshotSchema.safeParse(
      await this._getCached(cacheDir),
    );
    // Entries cached before timestamps existed fail the parse and are refetched.
    const snapshot = cached.success
      ? cached.data
      : await this._fetchAndCache({ ...args, cacheDir });
    // The GET /v1/portfolio defaults, so the totals match the Assets page.
    return {
      ...this._applyFilters(snapshot, {
        trusted: args.trusted,
        excludeDust: true,
      }),
      fetchedAt: snapshot.fetchedAt,
      expiresAt: snapshot.expiresAt,
    };
  }

  private _getCacheDir(args: {
    address: Address;
    fiatCode: string;
    trusted?: boolean;
    isTestnet?: boolean;
  }): CacheDir {
    return CacheRouter.getPortfolioCacheDir({
      address: args.address,
      fiatCode: args.fiatCode,
      trusted: args.trusted,
      isTestnet: args.isTestnet,
    });
  }

  private async _getCached(cacheDir: CacheDir): Promise<unknown> {
    const cached = await this.cacheService.hGet(cacheDir);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * Fetches and caches the portfolio. Concurrent misses for the same entry
   * share one fetch, so a page that asks several routes at once on an empty
   * cache pays for one Zerion call, not one per route. A miss right after a
   * clear can join a fetch that started before it, as a write could already.
   *
   * @param args - The wallet, filters and the cache entry to fill
   * @returns The fetched portfolio with its times
   */
  private _fetchAndCache(args: FetchArgs): Promise<PortfolioSnapshot> {
    const key = `${args.cacheDir.key}|${args.cacheDir.field}|${args.sync ? 'sync' : ''}`;
    const inFlight = this.inFlightFetches.get(key);
    if (inFlight) {
      return inFlight;
    }
    const fetch = this._fetchAndCacheOnce(args).finally(() => {
      this.inFlightFetches.delete(key);
    });
    this.inFlightFetches.set(key, fetch);
    return fetch;
  }

  /**
   * @param args - The wallet, filters and the cache entry to fill
   * @returns The fetched portfolio with its times
   */
  private async _fetchAndCacheOnce(
    args: FetchArgs,
  ): Promise<PortfolioSnapshot> {
    const rawPortfolio = await this.portfolioApi.getPortfolio({
      address: args.address,
      fiatCode: args.fiatCode,
      trusted: args.trusted,
      isTestnet: args.isTestnet,
      sync: args.sync,
    });
    const fetchedAt = Date.now();
    const { expiresAt, isSettling } = await this._getExpiry({
      address: args.address,
      fetchedAt,
    });
    const snapshot: PortfolioSnapshot = {
      ...PortfolioSchema.parse(rawPortfolio),
      fetchedAt,
      expiresAt,
    };
    await this.cacheService.hSet(
      args.cacheDir,
      JSON.stringify(snapshot),
      Math.ceil((expiresAt - fetchedAt) / 1_000),
      // No jitter in the settle window, so the entry never outlives it.
      isSettling ? 0 : undefined,
    );
    return snapshot;
  }

  /**
   * A transaction clears the cache before Zerion may have indexed it, so a
   * portfolio fetched within the settle window after a clear is only kept
   * until that window ends. The next read after it refetches the settled
   * balance, at most one extra Zerion call per clear.
   *
   * @param args.address - The wallet address
   * @param args.fetchedAt - When the portfolio was fetched, in epoch ms
   * @returns When the cached portfolio expires, in epoch ms, and whether that
   * was cut to the end of the settle window
   */
  private async _getExpiry(args: {
    address: Address;
    fetchedAt: number;
  }): Promise<{ expiresAt: number; isSettling: boolean }> {
    const expiresAt = args.fetchedAt + this.cacheExpirationSeconds * 1_000;
    const clearedAt = await this.cacheService.getCounter(
      CacheRouter.getPortfolioClearedAtCacheKey({ address: args.address }),
    );
    const settledAt =
      clearedAt === null ? null : clearedAt + this.settleSeconds * 1_000;
    if (settledAt === null || settledAt <= args.fetchedAt) {
      return { expiresAt, isSettling: false };
    }
    return settledAt < expiresAt
      ? { expiresAt: settledAt, isSettling: true }
      : { expiresAt, isSettling: false };
  }

  /**
   * Refreshes an address: invalidates all Zerion-backed caches (wallet
   * portfolio, portfolio route, positions). Not portfolio-route-only — the
   * three caches serve views of the same Zerion aggregation, so a refresh must
   * clear them together.
   *
   * @param {{ address: Address }} args - Clear parameters
   * @returns {Promise<void>} Promise that resolves when caches are cleared
   */
  public async clearZerionCaches(args: { address: Address }): Promise<void> {
    await this.zerionCache.invalidate(args.address, 'refresh');
  }

  /**
   * Applies filters to portfolio.
   *
   * @param {Portfolio} portfolio - Portfolio to filter
   * @param {{ chainIds?: Array<string>; trusted?: boolean; excludeDust?: boolean }} args - Filter options
   * @returns {Portfolio} Filtered portfolio
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
   * @param {Portfolio} portfolio - Portfolio to filter
   * @param {(token: TokenBalance) => boolean} tokenFilter - Filter function for tokens
   * @param {(position: AppPosition) => boolean} positionFilter - Filter function for positions
   * @returns {Portfolio} Filtered portfolio
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
   * @param {AppBalance} app - App balance to filter
   * @param {(position: AppPosition) => boolean} positionFilter - Filter function for positions
   * @returns {AppBalance | null} Filtered app balance or null if all groups are empty
   */
  private _filterAppBalance(
    app: AppBalance,
    positionFilter: (position: AppPosition) => boolean,
  ): AppBalance | null {
    const filteredGroups = app.groups
      .map((group) => {
        const filteredItems = group.items.filter(positionFilter);
        if (filteredItems.length === 0) {
          return null;
        }
        return {
          ...group,
          items: filteredItems,
        };
      })
      .filter((group): group is NonNullable<typeof group> => group !== null);

    if (filteredGroups.length === 0) {
      return null;
    }

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
   * @param {Portfolio} portfolio - Portfolio to filter
   * @param {Array<string>} chainIds - Chain IDs to include
   * @returns {Portfolio} Filtered portfolio
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
   * @param {Portfolio} portfolio - Portfolio to filter
   * @returns {Portfolio} Filtered portfolio
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
   * @param {Portfolio} portfolio - Portfolio to filter
   * @returns {Portfolio} Filtered portfolio
   */
  private _filterDustPositions(portfolio: Portfolio): Portfolio {
    const isDustFree = (item: { balanceFiat?: string }): boolean => {
      if (!item.balanceFiat) {
        return true;
      }
      const value = Math.abs(Number(item.balanceFiat));
      return value >= this.dustThresholdUsd;
    };

    return this._filterPortfolio(portfolio, isDustFree, isDustFree);
  }

  /**
   * Sums fiat balances from items.
   *
   * @param {Array<{ balanceFiat?: string }>} items - Items with balanceFiat property
   * @returns {number} Sum of fiat balances
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
   * @param {Array<TokenBalance>} tokenBalances - Filtered token balances
   * @param {Array<AppBalance>} appBalances - Filtered app balances
   * @returns {Portfolio} Portfolio with recalculated totals
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
