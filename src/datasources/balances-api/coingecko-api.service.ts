import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
<<<<<<< HEAD
import { IPricesApi } from '@/datasources/balances-api/prices-api.interface';
import { AssetPrice } from '@/datasources/balances-api/entities/asset-price.entity';
=======
import { ICoingeckoApi } from '@/datasources/balances-api/coingecko-api.interface';
import { CoingeckoAssetPrice } from '@/datasources/balances-api/entities/coingecko-asset-price.entity';
>>>>>>> c6bcaad0 (Move AssetPrice to CoingeckoAssetPrice)
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
import { difference, get } from 'lodash';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { asError } from '@/logging/utils';

@Injectable()
export class CoingeckoApi implements ICoingeckoApi {
  /**
   *  Coingecko API Key header name. To be included in http requests when using a paid subscription.
   */
  private static readonly pricesProviderHeader: string = 'x-cg-pro-api-key';

  /**
   * Coingecko API maximum amount of token addresses being requested in the same call.
   */
  private static readonly maxBatchSize: number = 100;

  /**
   * Time range in seconds used to get a random value when calculating a TTL for not-found token prices.
   */
  static readonly notFoundTtlRangeSeconds: number = 60 * 60 * 24;

  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly pricesTtlSeconds: number;
  private readonly notFoundPriceTtlSeconds: number;
  private readonly defaultExpirationTimeInSeconds: number;
  private readonly defaultNotFoundExpirationTimeSeconds: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly dataSource: CacheFirstDataSource,
    @Inject(NetworkService) private readonly networkService: INetworkService,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
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
    this.notFoundPriceTtlSeconds = this.configurationService.getOrThrow<number>(
      'balances.providers.safe.prices.notFoundPriceTtlSeconds',
    );
    this.defaultNotFoundExpirationTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.notFound.default',
      );
  }

  async getNativeCoinPrice(args: {
    chainId: string;
    fiatCode: string;
  }): Promise<number | null> {
    try {
      const lowerCaseFiatCode = args.fiatCode.toLowerCase();
      const nativeCoinId = this.configurationService.getOrThrow<string>(
        `balances.providers.safe.prices.chains.${args.chainId}.nativeCoin`,
      );
      const cacheDir = CacheRouter.getNativeCoinPriceCacheDir({
        nativeCoinId,
        fiatCode: lowerCaseFiatCode,
      });
      const url = `${this.baseUrl}/simple/price`;
<<<<<<< HEAD
      const result = await this.dataSource.get<AssetPrice>({
=======
      const result: CoingeckoAssetPrice = await this.dataSource.get({
>>>>>>> c6bcaad0 (Move AssetPrice to CoingeckoAssetPrice)
        cacheDir,
        url,
        networkRequest: {
          params: {
            vs_currencies: lowerCaseFiatCode,
            ids: nativeCoinId,
          },
          ...(this.apiKey && {
            headers: {
              [CoingeckoApi.pricesProviderHeader]: this.apiKey,
            },
          }),
        },
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.pricesTtlSeconds,
      });
      return result?.[nativeCoinId]?.[lowerCaseFiatCode];
    } catch (error) {
      // Error at this level are logged out, but not thrown to the upper layers.
      // The service won't throw an error if a single coin price retrieval fails.
      this.loggingService.error(
        `Error while getting native coin price: ${asError(error)} `,
      );
      return null;
    }
  }

  /**
   * Gets prices for a set of token addresses, trying to get them from cache first.
   * For those not found in the cache, it tries to retrieve them from the Coingecko API.
   *
   * @param args.chainName Coingecko's name for the chain (see configuration)
   * @param args.tokenAddresses Array of token addresses which prices are being retrieved
   * @param args.fiatCode
   * @returns Array of {@link CoingeckoAssetPrice}
   */
  async getTokenPrices(args: {
    chainId: string;
    tokenAddresses: string[];
    fiatCode: string;
  }): Promise<CoingeckoAssetPrice[]> {
    try {
      const lowerCaseFiatCode = args.fiatCode.toLowerCase();
      const lowerCaseTokenAddresses = args.tokenAddresses.map((address) =>
        address.toLowerCase(),
      );
      const chainName = this.configurationService.getOrThrow<string>(
        `balances.providers.safe.prices.chains.${args.chainId}.chainName`,
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

      return [pricesFromCache, pricesFromNetwork].flat();
    } catch (error) {
      // Error at this level are logged out, but not thrown to the upper layers.
      // The service won't throw an error if a single token price retrieval fails.
      this.loggingService.error(
        `Error while getting token prices: ${asError(error)} `,
      );
      return [];
    }
  }

  async getFiatCodes(): Promise<string[]> {
    try {
      const cacheDir = CacheRouter.getPriceFiatCodesCacheDir();
      const url = `${this.baseUrl}/simple/supported_vs_currencies`;
      const result = await this.dataSource.get<string[]>({
        cacheDir,
        url,
        networkRequest: {
          ...(this.apiKey && {
            headers: {
              [CoingeckoApi.pricesProviderHeader]: this.apiKey,
            },
          }),
        },
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
      return result.map((item) => item.toUpperCase());
    } catch (error) {
      this.loggingService.error(
        `CoinGecko error while getting fiat codes: ${asError(error)} `,
      );
      return [];
    }
  }

  private _mapProviderError(error: unknown): string {
    const errorCode =
      error instanceof NetworkResponseError && get(error, 'data.error_code');
    return errorCode ? ` [status: ${errorCode}]` : '';
  }

  /**
   * For an array of token addresses, gets the prices available from cache.
   */
  private async _getTokenPricesFromCache(args: {
    chainName: string;
    tokenAddresses: string[];
    fiatCode: string;
  }): Promise<CoingeckoAssetPrice[]> {
    const result: CoingeckoAssetPrice[] = [];
    for (const tokenAddress of args.tokenAddresses) {
      const cacheDir = CacheRouter.getTokenPriceCacheDir({
        ...args,
        tokenAddress,
      });
      const cached = await this.cacheService.get(cacheDir);
      const { key, field } = cacheDir;
      if (cached != null) {
        this.loggingService.debug({ type: 'cache_hit', key, field });
        result.push(JSON.parse(cached));
      } else {
        this.loggingService.debug({ type: 'cache_miss', key, field });
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
    tokenAddresses: string[];
    fiatCode: string;
  }): Promise<CoingeckoAssetPrice[]> {
    const prices = await this._requestPricesFromNetwork({
      ...args,
      tokenAddresses: args.tokenAddresses.slice(0, CoingeckoApi.maxBatchSize),
    });

    return Promise.all(
      args.tokenAddresses.map(async (tokenAddress) => {
        const validPrice = prices[tokenAddress]?.[args.fiatCode];
        const price: CoingeckoAssetPrice = validPrice
          ? { [tokenAddress]: { [args.fiatCode]: validPrice } }
          : { [tokenAddress]: { [args.fiatCode]: null } };
        await this.cacheService.set(
          CacheRouter.getTokenPriceCacheDir({ ...args, tokenAddress }),
          JSON.stringify(price),
          validPrice
            ? this.pricesTtlSeconds
            : this._getRandomNotFoundTokenPriceTtl(),
        );
        return price;
      }),
    );
  }

  /**
   * Requests the token prices provided by the CoinGecko API, using the {@link NetworkService}.
   */
  private async _requestPricesFromNetwork(args: {
    chainName: string;
    tokenAddresses: string[];
    fiatCode: string;
  }): Promise<CoingeckoAssetPrice> {
    try {
      const url = `${this.baseUrl}/simple/token_price/${args.chainName}`;
      const { data } = await this.networkService.get<CoingeckoAssetPrice>(url, {
        params: {
          vs_currencies: args.fiatCode,
          contract_addresses: args.tokenAddresses.join(','),
        },
        ...(this.apiKey && {
          headers: {
            [CoingeckoApi.pricesProviderHeader]: this.apiKey,
          },
        }),
      });
      return data;
    } catch (error) {
      throw new DataSourceError(
        `Error getting ${
          args.tokenAddresses
        } price from provider${this._mapProviderError(error)}`,
      );
    }
  }

  /**
   * Gets a random integer value between (notFoundPriceTtlSeconds - notFoundTtlRangeSeconds)
   * and (notFoundPriceTtlSeconds + notFoundTtlRangeSeconds).
   */
  private _getRandomNotFoundTokenPriceTtl(): number {
    const min =
      this.notFoundPriceTtlSeconds - CoingeckoApi.notFoundTtlRangeSeconds;
    const max =
      this.notFoundPriceTtlSeconds + CoingeckoApi.notFoundTtlRangeSeconds;
    return Math.floor(Math.random() * (max - min) + min);
  }
}
