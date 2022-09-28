import { Inject, Injectable } from '@nestjs/common';
import { ExchangeResult } from '../../domain/exchange/entities/exchange-result.entity';
import {
  INetworkService,
  NetworkService,
} from '../network/network.service.interface';
import { IConfigurationService } from '../../config/configuration.service.interface';
import { FiatCodesExchangeResult } from '../../domain/exchange/entities/fiat-codes-result.entity';
import { IExchangeApi } from '../../domain/interfaces/exchange-api.interface';
import { DataSourceError } from '../../domain/errors/data-source.error';

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

  async getFiatCodes(): Promise<FiatCodesExchangeResult> {
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

  async getExchangeResult(): Promise<ExchangeResult> {
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
