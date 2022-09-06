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
import { DefinedError, ValidateFunction } from 'ajv';
import { ValidationErrorFactory } from '../errors/validation-error-factory';
import { fiatCodesExchangeResultSchema } from './entities/schemas/fiat-codes-exchange-result.schema';
import { JsonSchemaService } from '../../common/schemas/json-schema.service';
import { exchangeResultSchema } from './entities/schemas/exchange-result.schema';

@Injectable()
export class ExchangeApi {
  // TODO can we depend on the base url instead?

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly isValidExchangeResult: ValidateFunction<ExchangeResult>;
  private readonly isValidFiatCodesExchangeResult: ValidateFunction<FiatCodesExchangeResult>;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(NetworkService) private readonly networkService: INetworkService,
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.baseUrl =
      this.configurationService.getOrThrow<string>('exchange.baseUri');
    this.apiKey =
      this.configurationService.getOrThrow<string>('exchange.apiKey');

    this.isValidExchangeResult = this.jsonSchemaService.compile(
      exchangeResultSchema,
    ) as ValidateFunction<ExchangeResult>;

    this.isValidFiatCodesExchangeResult = this.jsonSchemaService.compile(
      fiatCodesExchangeResultSchema,
    ) as ValidateFunction<FiatCodesExchangeResult>;
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

    if (!this.isValidExchangeResult(data)) {
      const errors = this.isValidExchangeResult.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return data;
  }

  private async getFiatCodesExchangeResult(): Promise<FiatCodesExchangeResult> {
    const { data } = await this.networkService.get(`${this.baseUrl}/symbols`, {
      params: { access_key: this.apiKey },
    });

    if (!this.isValidFiatCodesExchangeResult(data)) {
      const errors = this.isValidFiatCodesExchangeResult
        .errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return data;
  }
}
