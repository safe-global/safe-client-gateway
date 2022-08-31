import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ExchangeResult } from './entities/exchange-result.entity';
import {
  INetworkService,
  NetworkService,
} from '../../common/network/network.service.interface';
import { IConfigurationService } from '../../common/config/configuration.service.interface';
import { FiatCodesExchangeResult } from './entities/fiat-codes-result.entity';
import isValidExchangeResult from './entities/schemas/exchange-result.schema';
import { DefinedError } from 'ajv';
import { ValidationErrorFactory } from '../errors/validation-error-factory';
import isValidFiatCodesExchangeResult from './entities/schemas/fiat-codes-exchange-result.schema';

@Injectable()
export class ExchangeApi {
  // TODO can we depend on the base url instead?

  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(NetworkService) private readonly networkService: INetworkService,
    private readonly validationErrorFactory: ValidationErrorFactory,
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

    if (!isValidExchangeResult(data)) {
      const errors = isValidExchangeResult.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return data;
  }

  private async getFiatCodesExchangeResult(): Promise<FiatCodesExchangeResult> {
    const { data } = await this.networkService.get(`${this.baseUrl}/symbols`, {
      params: { access_key: this.apiKey },
    });

    if (!isValidFiatCodesExchangeResult(data)) {
      const errors = isValidFiatCodesExchangeResult.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return data;
  }
}
