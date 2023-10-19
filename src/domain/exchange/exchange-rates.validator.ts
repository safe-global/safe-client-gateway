import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { ExchangeRates } from '@/domain/exchange/entities/exchange-rates.entity';
import {
  EXCHANGE_RATES_SCHEMA_ID,
  exchangeRatesSchema,
} from '@/domain/exchange/entities/schemas/exchange-rates.schema';
import { IValidator } from '@/domain/interfaces/validator.interface';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';

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
