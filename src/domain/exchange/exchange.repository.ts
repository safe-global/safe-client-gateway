import { IExchangeRepository } from './exchange.repository.interface';
import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { IExchangeApi } from '../interfaces/exchange-api.interface';
import { ValidateFunction, DefinedError } from 'ajv';
import { JsonSchemaService } from '../../common/schemas/json-schema.service';
import { ValidationErrorFactory } from '../errors/validation-error-factory';
import { FiatCodesExchangeResult } from './entities/fiat-codes-result.entity';
import { fiatCodesExchangeResultSchema } from './entities/schemas/fiat-codes-exchange-result.schema';
import { exchangeResultSchema } from './entities/schemas/exchange-result.schema';
import { ExchangeResult } from './entities/exchange-result.entity';

@Injectable()
export class ExchangeRepository implements IExchangeRepository {
  private readonly isValidExchangeResult: ValidateFunction<ExchangeResult>;
  private readonly isValidFiatCodesExchangeResult: ValidateFunction<FiatCodesExchangeResult>;

  constructor(
    @Inject(IExchangeApi) private readonly exchangeApi: IExchangeApi,
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidExchangeResult = this.jsonSchemaService.compile(
      exchangeResultSchema,
    ) as ValidateFunction<ExchangeResult>;

    this.isValidFiatCodesExchangeResult = this.jsonSchemaService.compile(
      fiatCodesExchangeResultSchema,
    ) as ValidateFunction<FiatCodesExchangeResult>;
  }

  async convertRates(to: string, from: string): Promise<number> {
    const exchangeResult = await this.exchangeApi.getExchangeResult();

    if (!this.isValidExchangeResult(exchangeResult)) {
      const errors = this.isValidExchangeResult.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

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
    const data = await this.exchangeApi.getFiatCodes();

    if (!this.isValidFiatCodesExchangeResult(data)) {
      const errors = this.isValidFiatCodesExchangeResult
        .errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return Object.keys(data.symbols);
  }
}
