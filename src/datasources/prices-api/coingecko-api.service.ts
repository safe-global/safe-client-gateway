import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IPricesApi } from '@/domain/interfaces/prices-api.interface';
import { AssetPrice } from '@/domain/prices/entities/asset-price.entity';
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
import { difference } from 'lodash';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';

@Injectable()
export class CoingeckoApi implements IPricesApi {
  /**
   *  Coingecko API Key header name. To be included in http requests when using a paid subscription.
   */
  private static readonly pricesProviderHeader: string = 'x-cg-pro-api-key';

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
    this.apiKey = this.configurationService.get<string>('prices.apiKey');
    this.baseUrl =
      this.configurationService.getOrThrow<string>('prices.baseUri');
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
    this.pricesTtlSeconds = this.configurationService.getOrThrow<number>(
      'prices.pricesTtlSeconds',
    );
    this.notFoundPriceTtlSeconds = this.configurationService.getOrThrow<number>(
      'prices.notFoundPriceTtlSeconds',
    );
    this.defaultNotFoundExpirationTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.notFound.default',
      );
  }

  async getNativeCoinPrice(args: {
    nativeCoinId: string;
    fiatCode: string;
  }): Promise<AssetPrice> {
    try {
      const cacheDir = CacheRouter.getNativeCoinPriceCacheDir(args);
      const url = `${this.baseUrl}/simple/price`;
      return await this.dataSource.get({
        cacheDir,
        url,
        networkRequest: {
          params: {
            vs_currencies: args.fiatCode,
            ids: args.nativeCoinId,
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
    } catch (error) {
      throw new DataSourceError(
        `Error getting ${
          args.nativeCoinId
        } price from provider${this._mapProviderError(error)}`,
      );
    }
  }

  async getTokenPrices(args: {
    chainName: string;
    tokenAddresses: string[];
    fiatCode: string;
  }): Promise<[string, number | null][]> {
    const cachedAssetPrices = await this._getAssetPricesFromCache(args);
    const notCachedAddresses = difference(
      args.tokenAddresses,
      cachedAssetPrices.map((assetPrice) => assetPrice[0]),
    );
    const retrievedAssetPrices = await this._getAssetPricesFromProvider({
      ...args,
      notCachedAddresses,
    });

    const assetPrices = await Promise.all(
      notCachedAddresses.map(async (notCachedAddress) => {
        const price =
          retrievedAssetPrices.data[notCachedAddress]?.[args.fiatCode];
        const assetPrice: [string, number | null] = [
          notCachedAddress,
          price ?? null,
        ];
        await this.cacheService.set(
          CacheRouter.getTokenPriceCacheDir({
            ...args,
            tokenAddress: notCachedAddress,
          }),
          JSON.stringify(assetPrice),
          price
            ? this.pricesTtlSeconds
            : this._getRandomNotFoundTokenPriceTtl(),
        );
        return assetPrice;
      }),
    );

    return [cachedAssetPrices, assetPrices].flat();
  }

  async getFiatCodes(): Promise<string[]> {
    try {
      const cacheDir = CacheRouter.getPriceFiatCodesCacheDir();
      const url = `${this.baseUrl}/simple/supported_vs_currencies`;
      return await this.dataSource.get({
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
    } catch (error) {
      throw new DataSourceError(
        `Error getting Fiat Codes from prices provider${this._mapProviderError(
          error,
        )}`,
      );
    }
  }

  private _mapProviderError(error: any): string {
    const errorCode = error?.status?.error_code;
    return errorCode ? ` [status: ${errorCode}]` : '';
  }

  /**
   * Gets a random integer value between (notFoundPriceTtlSeconds - notFoundTtlRangeSeconds)
   * and (notFoundPriceTtlSeconds + notFoundTtlRangeSeconds).
   */
  private _getRandomNotFoundTokenPriceTtl() {
    const min =
      this.notFoundPriceTtlSeconds - CoingeckoApi.notFoundTtlRangeSeconds;
    const max =
      this.notFoundPriceTtlSeconds + CoingeckoApi.notFoundTtlRangeSeconds;
    return Math.floor(Math.random() * (max - min) + min);
  }

  private async _getAssetPricesFromCache(args: {
    chainName: string;
    tokenAddresses: string[];
    fiatCode: string;
  }): Promise<[string, number][]> {
    const result = await Promise.all(
      args.tokenAddresses.map(async (tokenAddress) => {
        const cacheDir = CacheRouter.getTokenPriceCacheDir({
          ...args,
          tokenAddress,
        });
        const cached = await this.cacheService.get(cacheDir);
        const { key, field } = cacheDir;
        if (cached != null) {
          this.loggingService.debug({ type: 'cache_hit', key, field });
          return JSON.parse(cached);
        }
        this.loggingService.debug({ type: 'cache_miss', key, field });
        return null;
      }),
    );

    return result.filter((i) => i !== null);
  }

  private async _getAssetPricesFromProvider(args: {
    chainName: string;
    notCachedAddresses: string[];
    fiatCode: string;
  }): Promise<AssetPrice> {
    try {
      const url = `${this.baseUrl}/simple/token_price/${args.chainName}`;
      return await this.networkService.get(url, {
        params: {
          vs_currencies: args.fiatCode,
          contract_addresses: args.notCachedAddresses.join(','),
        },
        ...(this.apiKey && {
          headers: {
            [CoingeckoApi.pricesProviderHeader]: this.apiKey,
          },
        }),
      });
    } catch (error) {
      throw new DataSourceError(
        `Error getting ${
          args.notCachedAddresses
        } price from provider${this._mapProviderError(error)}`,
      );
    }
  }
}
