import { Inject, Injectable } from '@nestjs/common';
import { ExchangeRates } from '../../domain/exchange/entities/exchange-rates.entity';
import {
  INetworkService,
  NetworkService,
} from '../network/network.service.interface';
import { ExchangeFiatCodes } from '../../domain/exchange/entities/exchange-fiat-codes.entity';
import { IExchangeApi } from '../../domain/interfaces/exchange-api.interface';
import { DataSourceError } from '../../domain/errors/data-source.error';
import { IConfigurationService } from '../../config/configuration.service.interface';

@Injectable()
export class ExchangeApi implements IExchangeApi {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(NetworkService) private readonly networkService: INetworkService,
  ) {
    this.baseUrl =
      this.configurationService.getOrThrow<string>('exchange.baseUri');
    this.apiKey =
      this.configurationService.getOrThrow<string>('exchange.apiKey');
  }

  async getFiatCodes(): Promise<ExchangeFiatCodes> {
    try {
      const { data } = await this.networkService.get(
        `${this.baseUrl}/symbols`,
        {
          params: { access_key: this.apiKey },
        },
      );
      return data;
    } catch (error) {
      throw new DataSourceError('Error getting Fiat Codes from exchange');
    }
  }

  async getRates(): Promise<ExchangeRates> {
    try {
      const { data } = await this.networkService.get(`${this.baseUrl}/latest`, {
        params: { access_key: this.apiKey },
      });

      return data;
    } catch (error) {
      throw new DataSourceError('Error getting exchange data');
    }
  }
}
