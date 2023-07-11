import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../validation/providers/json-schema.service';
import { IValidator } from '../interfaces/validator.interface';
import { ExchangeRates } from './entities/exchange-rates.entity';
import {
  EXCHANGE_RATES_SCHEMA_ID,
  exchangeRatesSchema,
} from './entities/schemas/exchange-rates.schema';

@Injectable()
export class ExchangeRatesValidator implements IValidator<ExchangeRates> {
  private readonly isValidExchangeRates: ValidateFunction<ExchangeRates>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidExchangeRates = this.jsonSchemaService.getSchema(
      EXCHANGE_RATES_SCHEMA_ID,
      exchangeRatesSchema,
    );
  }

  validate(data: unknown): ExchangeRates {
    return this.genericValidator.validate(this.isValidExchangeRates, data);
  }
}
