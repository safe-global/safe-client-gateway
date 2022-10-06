import { Injectable } from '@nestjs/common';
import { ValidateFunction, DefinedError } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { ValidationErrorFactory } from '../schema/validation-error-factory';
import { ExchangeRates } from './entities/exchange-rates.entity';
import { exchangeRatesSchema } from './entities/schemas/exchange-rates.schema';

@Injectable()
export class ExchangeRatesValidator implements IValidator<ExchangeRates> {
  private readonly isValidExchangeRates: ValidateFunction<ExchangeRates>;

  constructor(
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidExchangeRates = this.jsonSchemaService.compile(
      exchangeRatesSchema,
    ) as ValidateFunction<ExchangeRates>;
  }

  validate(data: unknown): ExchangeRates {
    if (!this.isValidExchangeRates(data)) {
      const errors = this.isValidExchangeRates.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return data as ExchangeRates;
  }
}
