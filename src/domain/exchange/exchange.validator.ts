import { Injectable } from '@nestjs/common';
import { ValidateFunction, DefinedError } from 'ajv';
import { JsonSchemaService } from '../../common/schemas/json-schema.service';
import { ValidationErrorFactory } from '../errors/validation-error-factory';
import { IValidator } from '../interfaces/validator.interface';
import { RatesExchangeResult } from './entities/rates-exchange-result.entity';
import { FiatCodesExchangeResult } from './entities/fiat-codes-exchange-result.entity';
import { fiatCodesExchangeResultSchema } from './entities/schemas/fiat-codes-exchange-result.schema';
import { ExchangeResult } from './entities/exchange-result.entity';
import { ratesExchangeResultSchema } from './entities/schemas/rates-exchange-result.schema';

@Injectable()
export class ExchangeValidator implements IValidator<ExchangeResult> {
  private readonly isValidRatesExchangeResult: ValidateFunction<RatesExchangeResult>;
  private readonly isValidFiatCodesExchangeResult: ValidateFunction<FiatCodesExchangeResult>;

  constructor(
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidRatesExchangeResult = this.jsonSchemaService.compile(
      ratesExchangeResultSchema,
    ) as ValidateFunction<RatesExchangeResult>;

    this.isValidFiatCodesExchangeResult = this.jsonSchemaService.compile(
      fiatCodesExchangeResultSchema,
    ) as ValidateFunction<FiatCodesExchangeResult>;
  }

  isRatesExchangeResult(data: ExchangeResult): data is RatesExchangeResult {
    return (data as RatesExchangeResult).rates !== undefined;
  }

  isFiatCodesExchangeResult(
    data: ExchangeResult,
  ): data is FiatCodesExchangeResult {
    return (data as FiatCodesExchangeResult).symbols !== undefined;
  }

  /**
   * Validates arbitrary data against one of the subtypes of {@link ExchangeResult}
   * @param data arbitrary data to be validated
   * @returns validated data coerced to a known type (extending from {@link ExchangeResult})
   */
  validate(data: unknown): ExchangeResult {
    if (this.isRatesExchangeResult(data as RatesExchangeResult)) {
      return this.validateByType<RatesExchangeResult>(
        data as RatesExchangeResult,
        this.isValidRatesExchangeResult,
      );
    }

    if (this.isFiatCodesExchangeResult(data as FiatCodesExchangeResult)) {
      return this.validateByType<FiatCodesExchangeResult>(
        data as FiatCodesExchangeResult,
        this.isValidFiatCodesExchangeResult,
      );
    }

    throw this.validationErrorFactory.from([]);
  }

  /**
   * Validates an array of items by calling {@link validate} for each one
   */
  validateMany(data: unknown[]): ExchangeResult[] {
    return data.map((item) => this.validate(item));
  }

  /**
   * Generic validation function to be executed against the provided {@link ValidateFunction}
   * Returns an object of the provided type, or throws an error provided by the {@link ValidationErrorFactory}
   * @param data arbitrary data to be validated
   * @param validationFn {@link ValidateFunction} to be applied to the data
   * @returns validated data coerced to a known type (extending from {@link ExchangeResult})
   */
  private validateByType<Type extends ExchangeResult>(
    data: Type,
    validationFn: ValidateFunction<Type>,
  ): Type {
    if (!validationFn(data)) {
      const errors = validationFn.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return data as Type;
  }
}
