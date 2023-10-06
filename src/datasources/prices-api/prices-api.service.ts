import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '../../config/configuration.service.interface';
import { IPricesApi } from '../../domain/interfaces/prices-api.interface';
import { AssetPrice } from '../../domain/prices/entities/asset-price.entity';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { CacheRouter } from '../cache/cache.router';
import { DataSourceError } from '../../domain/errors/data-source.error';
import { NetworkRequest } from '../network/entities/network.request.entity';

@Injectable()
export class PricesApi implements IPricesApi {
  private static readonly pricesProviderHeader: string = 'x-cg-pro-api-key';
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly pricesTtlSeconds: number;
  private readonly defaultExpirationTimeInSeconds: number;
  private readonly defaultNotFoundExpirationTimeSeconds: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly dataSource: CacheFirstDataSource,
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
      const url = `${this.baseUrl}/simple/price?ids=${args.nativeCoinId}&vs_currencies=${args.fiatCode}`;
      return await this.dataSource.get({
        cacheDir,
        url,
        networkRequest: this._buildNetworkRequest(),
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
      const url = `${this.baseUrl}/simple/token_price/${args.chainName}?contract_addresses=${args.tokenAddress}&vs_currencies=${args.fiatCode}`;
      const result: AssetPrice = await this.dataSource.get({
        cacheDir,
        url,
        networkRequest: this._buildNetworkRequest(),
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.pricesTtlSeconds,
      });
      return result;
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
      const result: string[] = await this.dataSource.get({
        cacheDir,
        url,
        networkRequest: this._buildNetworkRequest(),
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
      return result;
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

  private _buildNetworkRequest(): NetworkRequest | undefined {
    return this.apiKey
      ? { headers: { [PricesApi.pricesProviderHeader]: this.apiKey } }
      : undefined;
  }
}
