import { Inject, Injectable } from '@nestjs/common';
import { ExchangeRates } from '../../domain/exchange/entities/exchange-rates.entity';
import { ExchangeFiatCodes } from '../../domain/exchange/entities/exchange-fiat-codes.entity';
import { IExchangeApi } from '../../domain/interfaces/exchange-api.interface';
import { DataSourceError } from '../../domain/errors/data-source.error';
import { IConfigurationService } from '../../config/configuration.service.interface';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { CacheRouter } from '../cache/cache.router';

@Injectable()
export class ExchangeApi implements IExchangeApi {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly cacheTtlSeconds: number;

  private static readonly DEFAULT_CACHE_TTL_SECONDS = 60 * 60 * 12;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly dataSource: CacheFirstDataSource,
  ) {
    this.baseUrl =
      this.configurationService.getOrThrow<string>('exchange.baseUri');
    this.apiKey =
      this.configurationService.getOrThrow<string>('exchange.apiKey');
    this.cacheTtlSeconds =
      this.configurationService.get<number | undefined>(
        'exchange.cacheTtlSeconds',
      ) ?? ExchangeApi.DEFAULT_CACHE_TTL_SECONDS;
  }

  async getFiatCodes(): Promise<ExchangeFiatCodes> {
    try {
      return await this.dataSource.get<ExchangeFiatCodes>(
        CacheRouter.getExchangeFiatCodesCacheDir(),
        `${this.baseUrl}/symbols`,
        {
          headers: { apikey: this.apiKey },
        },
        this.cacheTtlSeconds,
      );
    } catch (error) {
      throw new DataSourceError('Error getting Fiat Codes from exchange');
    }
  }

  async getRates(): Promise<ExchangeRates> {
    try {
      return await this.dataSource.get<ExchangeRates>(
        CacheRouter.getExchangeRatesCacheDir(),
        `${this.baseUrl}/latest`,
        {
          headers: { apikey: this.apiKey },
        },
        this.cacheTtlSeconds,
      );
    } catch (error) {
      throw new DataSourceError('Error getting exchange data');
    }
  }
}
