import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ExchangeResult } from '../../domain/entities/exchange-result.entity';
import {
  INetworkService,
  NetworkService,
} from '../../common/network/network.service.interface';
import { IConfigurationService } from '../../common/config/configuration.service.interface';
import { FiatCodesExchangeResult } from '../../domain/entities/fiat-codes-result.entity';
import { IExchangeApi } from '../../domain/exchange-api.interface';

@Injectable()
export class ExchangeApi implements IExchangeApi {
  // TODO can we depend on the base url instead?

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

  async convertRates(to: string, from: string): Promise<number> {
    const exchangeResult = await this.getExchangeResult();

    if (exchangeResult.rates === undefined)
      throw new InternalServerErrorException(`Exchange rates unavailable`);

    const fromExchangeRate = exchangeResult.rates[from.toUpperCase()];
    if (fromExchangeRate === undefined || fromExchangeRate == 0)
      throw new InternalServerErrorException(
        `Exchange rate for ${from} is not available`,
      );
    const toExchangeRate = exchangeResult.rates[to.toUpperCase()];
    if (toExchangeRate === undefined)
      throw new InternalServerErrorException(
        `Exchange rate for ${to} is not available`,
      );

    return toExchangeRate / fromExchangeRate;
  }

  async getFiatCodes(): Promise<string[]> {
    const fiatCodesResult = await this.getFiatCodesExchangeResult();

    return Object.keys(fiatCodesResult.symbols);
  }

  private async getExchangeResult(): Promise<ExchangeResult> {
    const { data } = await this.networkService.get(`${this.baseUrl}/latest`, {
      params: { access_key: this.apiKey },
    });

    return data;
  }

  private async getFiatCodesExchangeResult(): Promise<FiatCodesExchangeResult> {
    const { data } = await this.networkService.get(`${this.baseUrl}/symbols`, {
      params: { access_key: this.apiKey },
    });

    return data;
  }
}
