import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IPricesApi } from '@/datasources/balances-api/prices-api.interface';
import {
  AssetPrice,
  getAssetPriceSchema,
} from '@/datasources/balances-api/entities/asset-price.entity';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { CacheRouter } from '../cache/cache.router';
import { DataSourceError } from '@/domain/errors/data-source.error';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import {
  NetworkService,
  INetworkService,
} from '@/datasources/network/network.service.interface';
import difference from 'lodash/difference';
import get from 'lodash/get';
import random from 'lodash/random';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { asError } from '@/logging/utils';
import { Chain } from '@/domain/chains/entities/chain.entity';
import { z } from 'zod';
import { rawify, type Raw } from '@/validation/entities/raw.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { LogType } from '@/domain/common/entities/log-type.entity';
import chunk from 'lodash/chunk';
import merge from 'lodash/merge';

/**
 * TODO: Refactor away the return of currency codes from public methods, e.g.
 *
 * {                                  {
 *   usd: number;                       price: number;
 *   usd_24h_change: number;    =>      price_24h_change: number;
 * }                                  }
 */
@Injectable()
export class CoingeckoApi implements IPricesApi {
  /**
   *  Coingecko API Key header name. To be included in http requests when using a paid subscription.
   */
  private static readonly COINGECKO_API_HEADER: string = 'x-cg-pro-api-key';
  /**
   * Coingecko API maximum amount of token addresses being requested in the same call.
   */
  private static readonly MAX_BATCH_SIZE: number = 100;
  /**
   * Time range in seconds used to get a random value when calculating a TTL for not-found token prices.
   */
  static readonly NOT_FOUND_TTL_RANGE_SECONDS: number = 600; // 10 minutes
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly defaultExpirationTimeInSeconds: number;
  private readonly defaultNotFoundExpirationTimeSeconds: number;
  private readonly pricesTtlSeconds: number;
  /**
   * TTL in seconds for native coin prices.
   */
  private readonly nativeCoinPricesTtlSeconds: number;
  /**
   * TTL in seconds for a not found token price.
   */
  private readonly notFoundPriceTtlSeconds: number;
  /**
   * Token addresses that will be cached with a highRefreshRateTokensTtlSeconds TTL.
   */
  private readonly highRefreshRateTokens: Array<string>;
  /**
   * TTL in seconds for high-rate refresh token prices.
   */
  private readonly highRefreshRateTokensTtlSeconds: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly dataSource: CacheFirstDataSource,
    @Inject(NetworkService) private readonly networkService: INetworkService,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(CACHE_MANAGER) private readonly inMemoryCache: Cache,
  ) {
    this.apiKey = this.configurationService.get<string>(
      'balances.providers.safe.prices.apiKey',
    );
    this.baseUrl = this.configurationService.getOrThrow<string>(
      'balances.providers.safe.prices.baseUri',
    );
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
    this.pricesTtlSeconds = this.configurationService.getOrThrow<number>(
      'balances.providers.safe.prices.pricesTtlSeconds',
    );
    this.nativeCoinPricesTtlSeconds =
      this.configurationService.getOrThrow<number>(
        'balances.providers.safe.prices.nativeCoinPricesTtlSeconds',
      );
    this.notFoundPriceTtlSeconds = this.configurationService.getOrThrow<number>(
      'balances.providers.safe.prices.notFoundPriceTtlSeconds',
    );
    this.defaultNotFoundExpirationTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.notFound.default',
      );
    // Coingecko expects the token addresses to be lowercase, so lowercase addresses are enforced here.
    this.highRefreshRateTokens = this.configurationService
      .getOrThrow<
        Array<string>
      >('balances.providers.safe.prices.highRefreshRateTokens')
      .map((tokenAddress) => tokenAddress.toLowerCase());

    this.highRefreshRateTokensTtlSeconds =
      this.configurationService.getOrThrow<number>(
        'balances.providers.safe.prices.highRefreshRateTokensTtlSeconds',
      );
  }

  /**
   * Retrieves the price/change of a chain's native coin, prioritizing memory cache,
   * followed by persistent cache. If the price is unavailable in both, it fetches
   * the data from the Coingecko API.
   *
   * @param args.chain The chain entity containing chain-specific configuration.
   * @param args.fiatCode The fiat currency code for the price conversion.
   * @returns A numerical price/change of the native coin price, or null if unavailable.
   */
  async getNativeCoinPrice(args: {
    chain: Chain;
    fiatCode: string;
    // TODO: Change to Raw when cache service is migrated
  }): Promise<AssetPrice[string] | null> {
    try {
      const nativeCoinId = args.chain.pricesProvider.nativeCoin;
      if (nativeCoinId == null) {
        throw new DataSourceError('pricesProvider.nativeCoinId is not defined');
      }
      const lowerCaseFiatCode = args.fiatCode.toLowerCase();
      const cacheDir = CacheRouter.getNativeCoinPriceCacheDir({
        nativeCoinId,
        fiatCode: lowerCaseFiatCode,
      });
      const memoryItem = await this.inMemoryCache.get<AssetPrice[string]>(
        CacheRouter.getMemoryKey(cacheDir),
      );
      if (memoryItem != null) {
        this.logMemoryHit(cacheDir.key);
        return memoryItem;
      }
      this.logMemoryMiss(cacheDir.key);
      const url = `${this.baseUrl}/simple/price`;
      const result = await this.dataSource
        .get<AssetPrice>({
          cacheDir,
          url,
          networkRequest: {
            params: {
              vs_currencies: lowerCaseFiatCode,
              ids: nativeCoinId,
              include_24hr_change: true,
            },
            ...(this.apiKey && {
              headers: {
                [CoingeckoApi.COINGECKO_API_HEADER]: this.apiKey,
              },
            }),
          },
          notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
          expireTimeSeconds: this.nativeCoinPricesTtlSeconds,
        })
        .then(getAssetPriceSchema(lowerCaseFiatCode).parse);
      // TODO: Change to Raw when cache service is migrated
      const nativeCoinPrice = result?.[nativeCoinId];
      await this.inMemoryCache.set(
        CacheRouter.getMemoryKey(cacheDir),
        nativeCoinPrice,
        this.nativeCoinPricesTtlSeconds * 1_000,
      );
      return nativeCoinPrice;
    } catch (error) {
      // Error at this level are logged out, but not thrown to the upper layers.
      // The service won't throw an error if a single coin price retrieval fails.
      this.loggingService.error(
        `Error getting native coin price: ${asError(error)} `,
      );
      // TODO: Change to Raw when cache service is migrated
      return null;
    }
  }

  /**
   * Gets prices for a set of token addresses, trying to get them from cache first.
   * For those not found in the cache, it tries to retrieve them from the Coingecko API.
   *
   * @param args.chain Chain entity containing the chain-specific configuration
   * @param args.tokenAddresses Array of token addresses which prices are being retrieved
   * @param args.fiatCode
   * @returns Array of {@link AssetPrice}
   */
  async getTokenPrices(args: {
    chain: Chain;
    tokenAddresses: Array<string>;
    fiatCode: string;
  }): Promise<Raw<Array<AssetPrice>>> {
    try {
      const chainName = args.chain.pricesProvider.chainName;
      if (chainName == null) {
        throw new DataSourceError('pricesProvider.chainName is not defined');
      }
      const lowerCaseFiatCode = args.fiatCode.toLowerCase();
      const lowerCaseTokenAddresses = args.tokenAddresses.map((address) =>
        address.toLowerCase(),
      );
      const pricesFromCache = await this._getTokenPricesFromCache({
        chainName,
        tokenAddresses: lowerCaseTokenAddresses,
        fiatCode: lowerCaseFiatCode,
      });
      const notCachedTokenPrices = difference(
        lowerCaseTokenAddresses,
        pricesFromCache.map((assetPrice) => Object.keys(assetPrice)).flat(),
      );
      const pricesFromNetwork = notCachedTokenPrices.length
        ? await this._getTokenPricesFromNetwork({
            chainName,
            fiatCode: lowerCaseFiatCode,
            tokenAddresses: notCachedTokenPrices,
          })
        : [];

      return rawify([pricesFromCache, pricesFromNetwork].flat());
    } catch (error) {
      // Error at this level are logged out, but not thrown to the upper layers.
      // The service won't throw an error if a single token price retrieval fails.
      this.loggingService.error(
        `Error getting token prices: ${asError(error)} `,
      );
      return rawify([]);
    }
  }

  async getFiatCodes(): Promise<Raw<Array<string>>> {
    try {
      const cacheDir = CacheRouter.getPriceFiatCodesCacheDir();
      const url = `${this.baseUrl}/simple/supported_vs_currencies`;
      const result = await this.dataSource
        .get<Array<string>>({
          cacheDir,
          url,
          networkRequest: {
            ...(this.apiKey && {
              headers: {
                [CoingeckoApi.COINGECKO_API_HEADER]: this.apiKey,
              },
            }),
          },
          notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
          expireTimeSeconds: this.defaultExpirationTimeInSeconds,
        })
        .then(z.array(z.string()).parse);
      return rawify(result.map((item) => item.toUpperCase()));
    } catch (error) {
      this.loggingService.error(
        `CoinGecko error getting fiat codes: ${asError(error)} `,
      );
      return rawify([]);
    }
  }

  private _mapProviderError(error: unknown): string {
    const errorCode =
      error instanceof NetworkResponseError && get(error, 'data.error_code');
    return errorCode ? ` [status: ${errorCode}]` : '';
  }

  /**
   * For an array of token addresses, gets the prices available from memory or cache.
   * For each item:
   *  - If found in memory, the value is added to the result.
   *  - Else if not found in memory:
   *    - If found in cache, the value is added to the result and stored in memory.
   *    - Else if not found in cache, no value is added to the result.
   */
  private async _getTokenPricesFromCache(args: {
    chainName: string;
    tokenAddresses: Array<string>;
    fiatCode: string;
  }): Promise<Array<AssetPrice>> {
    const result: Array<AssetPrice> = [];
    const AssetPriceSchema = getAssetPriceSchema(args.fiatCode.toLowerCase());
    for (const tokenAddress of args.tokenAddresses) {
      const cacheDir = CacheRouter.getTokenPriceCacheDir({
        ...args,
        tokenAddress,
      });
      const memoryItem = await this.inMemoryCache.get<string>(
        CacheRouter.getMemoryKey(cacheDir),
      );
      if (memoryItem != null) {
        this.logMemoryHit(cacheDir.key);
        result.push(AssetPriceSchema.parse(JSON.parse(memoryItem)));
      } else {
        this.logMemoryMiss(cacheDir.key);
        const cacheItem = await this.cacheService.hGet(cacheDir);
        if (cacheItem != null) {
          this.logCacheHit(cacheDir);
          const assetPrice = AssetPriceSchema.parse(JSON.parse(cacheItem));
          const price = assetPrice[tokenAddress]?.[args.fiatCode];
          await this.inMemoryCache.set(
            CacheRouter.getMemoryKey(cacheDir),
            cacheItem,
            this._getTtl(price, tokenAddress) * 1_000, // Milliseconds
          );
          result.push(assetPrice);
        } else {
          this.logCacheMiss(cacheDir);
        }
      }
    }
    return result;
  }

  /**
   * For an array of token addresses, gets the prices available from the CoinGecko API.
   * Stores both retrieved prices and not-found prices in cache.
   */
  private async _getTokenPricesFromNetwork(args: {
    chainName: string;
    tokenAddresses: Array<string>;
    fiatCode: string;
  }): Promise<Array<AssetPrice>> {
    const lowerCaseFiatCode = args.fiatCode.toLowerCase();
    const prices = await this._requestPricesFromNetwork({
      ...args,
      tokenAddresses: args.tokenAddresses,
    }).then(getAssetPriceSchema(lowerCaseFiatCode).parse);

    return Promise.all(
      args.tokenAddresses.map(async (tokenAddress) => {
        const price = prices[tokenAddress]?.[lowerCaseFiatCode];
        const change =
          prices[tokenAddress]?.[`${lowerCaseFiatCode}_24h_change`];

        // change is excluded if we don't have a price
        const assetPrice: AssetPrice = price
          ? {
              [tokenAddress]: {
                [lowerCaseFiatCode]: price,
                [`${lowerCaseFiatCode}_24h_change`]: change,
              },
            }
          : {
              [tokenAddress]: {
                [lowerCaseFiatCode]: null,
                [`${lowerCaseFiatCode}_24h_change`]: null,
              },
            };
        const cacheDir = CacheRouter.getTokenPriceCacheDir({
          ...args,
          tokenAddress,
        });
        await this.cacheService.hSet(
          cacheDir,
          JSON.stringify(assetPrice),
          this._getTtl(price, tokenAddress),
        );
        await this.inMemoryCache.set(
          CacheRouter.getMemoryKey(cacheDir),
          JSON.stringify(assetPrice),
          this._getTtl(price, tokenAddress) * 1_000,
        );
        return assetPrice;
      }),
    );
  }

  /**
   * Gets the cache TTL for storing the price value.
   * If the token address is included in {@link highRefreshRateTokens} (defaults to []),
   * then {@link highRefreshRateTokensTtlSeconds} is used (defaults to 30 seconds).
   * If the price cannot ve retrieved (or it's zero) {@link _getRandomNotFoundTokenPriceTtl} is called.
   * Else {@link pricesTtlSeconds} is used (defaults to 300 seconds).
   */
  private _getTtl(
    price: number | null | undefined,
    tokenAddress: string,
  ): number {
    if (this.highRefreshRateTokens.includes(tokenAddress)) {
      return this.highRefreshRateTokensTtlSeconds;
    }

    return !price
      ? this._getRandomNotFoundTokenPriceTtl()
      : this.pricesTtlSeconds;
  }

  /**
   * Requests the token prices provided by the CoinGecko API, using the {@link NetworkService}.
   */
  async _requestPricesFromNetwork(args: {
    chainName: string;
    tokenAddresses: Array<string>;
    fiatCode: string;
  }): Promise<Raw<AssetPrice>> {
    const uniqueTokenAddresses = Array.from(
      new Set(args.tokenAddresses.map((address) => address.toLowerCase())),
    );

    // CoinGecko limits the number of token addresses that can be queried at once
    const tokenAddressBatches = chunk(
      uniqueTokenAddresses,
      CoingeckoApi.MAX_BATCH_SIZE,
    );

    try {
      const url = `${this.baseUrl}/simple/token_price/${args.chainName}`;
      const res = await Promise.allSettled(
        tokenAddressBatches.map((tokenAddresses) => {
          return this.networkService.get<AssetPrice>({
            url,
            networkRequest: {
              params: {
                vs_currencies: args.fiatCode.toLowerCase(),
                contract_addresses: tokenAddresses.join(','),
                include_24hr_change: true,
              },
              ...(this.apiKey && {
                headers: {
                  [CoingeckoApi.COINGECKO_API_HEADER]: this.apiKey,
                },
              }),
            },
          });
        }),
      );

      if (res.every((item) => item.status === 'rejected')) {
        throw res[0].reason;
      }

      const fulfilled = res
        .filter((item) => item.status === 'fulfilled')
        .map((item) => item.value.data);

      return merge({}, ...fulfilled);
    } catch (error) {
      throw new DataSourceError(
        `Error getting ${
          args.tokenAddresses
        } price from provider${this._mapProviderError(error)}`,
      );
    }
  }

  /**
   * Gets a random integer value between notFoundPriceTtlSeconds and (notFoundPriceTtlSeconds + notFoundTtlRangeSeconds).
   * The minimum result will be greater than notFoundTtlRangeSeconds to avoid having a negative TTL.
   */
  private _getRandomNotFoundTokenPriceTtl(): number {
    return random(
      this.notFoundPriceTtlSeconds,
      this.notFoundPriceTtlSeconds + CoingeckoApi.NOT_FOUND_TTL_RANGE_SECONDS,
    );
  }

  private logCacheHit(cacheDir: CacheDir): void {
    this.loggingService.debug({
      type: LogType.CacheHit,
      key: cacheDir.key,
      field: cacheDir.field,
    });
  }

  private logCacheMiss(cacheDir: CacheDir): void {
    this.loggingService.debug({
      type: LogType.CacheMiss,
      key: cacheDir.key,
      field: cacheDir.field,
    });
  }

  private logMemoryHit(key: string): void {
    this.loggingService.debug({
      type: LogType.MemoryHit,
      key,
    });
  }

  private logMemoryMiss(key: string): void {
    this.loggingService.debug({
      type: LogType.MemoryMiss,
      key,
    });
  }
}
