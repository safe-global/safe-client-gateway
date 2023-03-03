import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../validation/providers/json-schema.service';
import { IValidator } from '../interfaces/validator.interface';
import { ExchangeFiatCodes } from './entities/exchange-fiat-codes.entity';
import { exchangeFiatCodesSchema } from './entities/schemas/exchange-fiat-codes.schema';

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
      'https://safe-client.safe.global/schemas/exchange/exchange-fiat-codes.json',
      exchangeFiatCodesSchema,
    );
  }

  validate(data: unknown): ExchangeFiatCodes {
    return this.genericValidator.validate(this.isValidExchangeFiatCodes, data);
  }
}
