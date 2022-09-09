import { Injectable } from '@nestjs/common';
import { ValidateFunction, DefinedError } from 'ajv';
import { JsonSchemaService } from '../../common/schemas/json-schema.service';
import { ValidationErrorFactory } from '../errors/validation-error-factory';
import { IValidator } from '../interfaces/validator.interface';
import { RatesExchangeResult } from './entities/rates-exchange-result.entity';
import { FiatCodesExchangeResult } from './entities/fiat-codes-exchange-result.entity';
import { exchangeResultSchema } from './entities/schemas/rates-exchange-result.schema';
import { fiatCodesExchangeResultSchema } from './entities/schemas/fiat-codes-exchange-result.schema';
import { ExchangeResult } from './entities/exchange-result.entity';

@Injectable()
export class ExchangeValidator implements IValidator<ExchangeResult> {
  private readonly isValidExchangeResult: ValidateFunction<RatesExchangeResult>;
  private readonly isValidFiatCodesExchangeResult: ValidateFunction<FiatCodesExchangeResult>;

  constructor(
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidExchangeResult = this.jsonSchemaService.compile(
      exchangeResultSchema,
    ) as ValidateFunction<RatesExchangeResult>;

    this.isValidFiatCodesExchangeResult = this.jsonSchemaService.compile(
      fiatCodesExchangeResultSchema,
    ) as ValidateFunction<FiatCodesExchangeResult>;
  }

  isExchangeResult(data: ExchangeResult): data is RatesExchangeResult {
    return (data as RatesExchangeResult).rates !== undefined;
  }

  isFiatCodesExchangeResult(
    data: ExchangeResult,
  ): data is FiatCodesExchangeResult {
    return (data as FiatCodesExchangeResult).symbols !== undefined;
  }

  validate(data: unknown): ExchangeResult {
    if (this.isExchangeResult(data as RatesExchangeResult)) {
      if (!this.isValidExchangeResult(data)) {
        const errors = this.isValidExchangeResult.errors as DefinedError[];
        throw this.validationErrorFactory.from(errors);
      }

      return data as RatesExchangeResult;
    }

    if (!this.isValidFiatCodesExchangeResult(data)) {
      const errors = this.isValidFiatCodesExchangeResult
        .errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return data as FiatCodesExchangeResult;
  }
  validateMany(data: unknown[]): ExchangeResult[] {
    return data.map((item) => this.validate(item));
  }
}
