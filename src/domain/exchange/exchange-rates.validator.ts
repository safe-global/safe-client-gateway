import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import { ExchangeRates } from './entities/exchange-rates.entity';
import { exchangeRatesSchema } from './entities/schemas/exchange-rates.schema';

@Injectable()
export class ExchangeRatesValidator implements IValidator<ExchangeRates> {
  private readonly isValidExchangeRates: ValidateFunction<ExchangeRates>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidExchangeRates = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/exchange/exchange-rates.json',
      exchangeRatesSchema,
    );
  }

  validate(data: unknown): ExchangeRates {
    return this.genericValidator.validate(this.isValidExchangeRates, data);
  }
}
