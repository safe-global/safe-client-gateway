import { Injectable } from '@nestjs/common';
import { ValidateFunction, DefinedError } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { ValidationErrorFactory } from '../schema/validation-error-factory';
import { RatesExchangeResult } from './entities/rates-exchange-result.entity';
import { ratesExchangeResultSchema } from './entities/schemas/rates-exchange-result.schema';

@Injectable()
export class RatesExchangeResultValidator
  implements IValidator<RatesExchangeResult>
{
  private readonly isValidRatesExchangeResult: ValidateFunction<RatesExchangeResult>;

  constructor(
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidRatesExchangeResult = this.jsonSchemaService.compile(
      ratesExchangeResultSchema,
    ) as ValidateFunction<RatesExchangeResult>;
  }

  /**
   * Validates arbitrary data against {@link RatesExchangeResult}
   * @param data arbitrary data to be validated
   * @returns a validated {@link RatesExchangeResult}
   */
  validate(data: unknown): RatesExchangeResult {
    if (!this.isValidRatesExchangeResult(data)) {
      const errors = this.isValidRatesExchangeResult.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return data as RatesExchangeResult;
  }
}
