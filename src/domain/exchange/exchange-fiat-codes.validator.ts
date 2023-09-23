import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import { IValidator } from '../interfaces/validator.interface';
import { ExchangeFiatCodes } from './entities/exchange-fiat-codes.entity';
import {
  EXCHANGE_FIAT_CODES_SCHEMA_ID,
  exchangeFiatCodesSchema,
} from './entities/schemas/exchange-fiat-codes.schema';

@Injectable()
export class ExchangeFiatCodesValidator
  implements IValidator<ExchangeFiatCodes>
{
  private readonly isValidExchangeFiatCodes: ValidateFunction<ExchangeFiatCodes>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidExchangeFiatCodes = this.jsonSchemaService.getSchema(
      EXCHANGE_FIAT_CODES_SCHEMA_ID,
      exchangeFiatCodesSchema,
    );
  }

  validate(data: unknown): ExchangeFiatCodes {
    return this.genericValidator.validate(this.isValidExchangeFiatCodes, data);
  }
}
