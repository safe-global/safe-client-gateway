import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { ExchangeFiatCodes } from '@/domain/exchange/entities/exchange-fiat-codes.entity';
import {
  EXCHANGE_FIAT_CODES_SCHEMA_ID,
  exchangeFiatCodesSchema,
} from '@/domain/exchange/entities/schemas/exchange-fiat-codes.schema';
import { IValidator } from '@/domain/interfaces/validator.interface';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';

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
