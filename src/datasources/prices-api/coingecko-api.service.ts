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

@Injectable()
export class CoingeckoApi implements IPricesApi {
  /**
   *  Coingecko API Key header name. To be included in http requests when using a paid subscription.
   */
  private static readonly pricesProviderHeader: string = 'x-cg-pro-api-key';

  /**
   * Time range in seconds used to get a random value when calculating a TTL for not-found token prices.
   */
  static readonly notFoundTtlRange: number = 60 * 60 * 24;

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
    @Inject(CacheService) private readonly cacheService: ICacheService,
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
  async getTokenPrice(args: {
    chainName: string;
    tokenAddress: string;
    fiatCode: string;
  }): Promise<AssetPrice> {
    try {
      const cacheDir = CacheRouter.getTokenPriceCacheDir(args);
      const url = `${this.baseUrl}/simple/token_price/${args.chainName}`;
      return await this.dataSource.get({
        cacheDir,
        url,
        networkRequest: {
          params: {
            vs_currencies: args.fiatCode,
            contract_addresses: args.tokenAddress,
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
          args.tokenAddress
        } price from provider${this._mapProviderError(error)}`,
      );
    }
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

  async registerNotFoundTokenPrice(args: {
    chainName: string;
    tokenAddress: string;
    fiatCode: string;
  }): Promise<void> {
    const cacheDir = CacheRouter.getTokenPriceCacheDir(args);
    const expireTimeSeconds = this._getRandomNotFoundTokenPriceTtl();
    return this.cacheService.expire(cacheDir.key, expireTimeSeconds);
  }

  private _mapProviderError(error: any): string {
    const errorCode = error?.status?.error_code;
    return errorCode ? ` [status: ${errorCode}]` : '';
  }

  /**
   * Gets a random integer value between (notFoundPriceTtlSeconds - notFoundTtlRange)
   * and (notFoundPriceTtlSeconds + notFoundTtlRange).
   */
  private _getRandomNotFoundTokenPriceTtl() {
    const min = this.notFoundPriceTtlSeconds - CoingeckoApi.notFoundTtlRange;
    const max = this.notFoundPriceTtlSeconds + CoingeckoApi.notFoundTtlRange;
    return Math.floor(Math.random() * (max - min) + min);
  }
}
