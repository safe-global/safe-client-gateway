import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { ExchangeFiatCodes } from '@/domain/exchange/entities/exchange-fiat-codes.entity';
import { ExchangeRates } from '@/domain/exchange/entities/exchange-rates.entity';
import { IExchangeApi } from '@/domain/interfaces/exchange-api.interface';

@Injectable()
export class ExchangeApi implements IExchangeApi {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly cacheTtlSeconds: number;
  private readonly defaultNotFoundExpirationTimeSeconds: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly dataSource: CacheFirstDataSource,
  ) {
    this.baseUrl =
      this.configurationService.getOrThrow<string>('exchange.baseUri');
    this.apiKey =
      this.configurationService.getOrThrow<string>('exchange.apiKey');
    this.cacheTtlSeconds = this.configurationService.getOrThrow<number>(
      'exchange.cacheTtlSeconds',
    );
    this.defaultNotFoundExpirationTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.notFound.default',
      );
  }

  async getFiatCodes(): Promise<ExchangeFiatCodes> {
    try {
      return await this.dataSource.get<ExchangeFiatCodes>({
        cacheDir: CacheRouter.getExchangeFiatCodesCacheDir(),
        url: `${this.baseUrl}/symbols?access_key=${this.apiKey}`,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.cacheTtlSeconds,
      });
    } catch (error) {
      throw new DataSourceError('Error getting Fiat Codes from exchange');
    }
  }

  async getRates(): Promise<ExchangeRates> {
    try {
      return await this.dataSource.get<ExchangeRates>({
        cacheDir: CacheRouter.getExchangeRatesCacheDir(),
        url: `${this.baseUrl}/latest?access_key=${this.apiKey}`,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.cacheTtlSeconds,
      });
    } catch (error) {
      throw new DataSourceError('Error getting exchange data');
    }
  }
}
