import { IExchangeRepository } from './exchange.repository.interface';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { IExchangeApi } from '../interfaces/exchange-api.interface';
import { ValidateFunction, DefinedError } from 'ajv';
import { JsonSchemaService } from '../schema/json-schema.service';
import { ValidationErrorFactory } from '../schema/validation-error-factory';
import { FiatCodesExchangeResult } from './entities/fiat-codes-result.entity';
import { fiatCodesExchangeResultSchema } from './entities/schemas/fiat-codes-exchange-result.schema';
import { exchangeResultSchema } from './entities/schemas/exchange-result.schema';
import { ExchangeResult } from './entities/exchange-result.entity';

@Injectable()
export class ExchangeRepository implements IExchangeRepository {
  constructor(
    @Inject(IExchangeApi) private readonly exchangeApi: IExchangeApi,
    private readonly ratesExchangeResultValidator: RatesExchangeResultValidator,
    private readonly fiatCodesExchangeResultValidator: FiatCodesExchangeResultValidator,
  ) {}

  async convertRates(to: string, from: string): Promise<number> {
    const ratesExchangeResult = await this.exchangeApi.getRates();
    this.ratesExchangeResultValidator.validate(ratesExchangeResult);

    const fromExchangeRate = ratesExchangeResult.rates[from.toUpperCase()];
    if (fromExchangeRate === undefined || fromExchangeRate == 0)
      throw new InternalServerErrorException(
        `Exchange rate for ${from} is not available`,
      );

    const toExchangeRate = ratesExchangeResult.rates[to.toUpperCase()];
    if (toExchangeRate === undefined)
      throw new InternalServerErrorException(
        `Exchange rate for ${to} is not available`,
      );

    return toExchangeRate / fromExchangeRate;
  }

  async getFiatCodes(): Promise<string[]> {
    const data = await this.exchangeApi.getFiatCodes();
    this.fiatCodesExchangeResultValidator.validate(data);
    return Object.keys(data.symbols);
  }
}
