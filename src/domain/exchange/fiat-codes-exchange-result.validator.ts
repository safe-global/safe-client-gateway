import { Injectable } from '@nestjs/common';
import { ValidateFunction, DefinedError } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { ValidationErrorFactory } from '../schema/validation-error-factory';
import { FiatCodesExchangeResult } from './entities/fiat-codes-exchange-result.entity';
import { fiatCodesExchangeResultSchema } from './entities/schemas/fiat-codes-exchange-result.schema';

@Injectable()
export class FiatCodesExchangeResultValidator
  implements IValidator<FiatCodesExchangeResult>
{
  private readonly isValidFiatCodesExchangeResult: ValidateFunction<FiatCodesExchangeResult>;

  constructor(
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidFiatCodesExchangeResult = this.jsonSchemaService.compile(
      fiatCodesExchangeResultSchema,
    ) as ValidateFunction<FiatCodesExchangeResult>;
  }
  /**
   * Validates arbitrary data against {@link FiatCodesExchangeResult}
   * @param data arbitrary data to be validated
   * @returns a validated {@link FiatCodesExchangeResult}
   */
  validate(data: unknown): FiatCodesExchangeResult {
    if (!this.isValidFiatCodesExchangeResult(data)) {
      const errors = this.isValidFiatCodesExchangeResult
        .errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return data as FiatCodesExchangeResult;
  }
}
