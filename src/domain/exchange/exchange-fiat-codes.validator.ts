import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
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
    this.isValidExchangeFiatCodes = this.jsonSchemaService.compile(
      exchangeFiatCodesSchema,
    ) as ValidateFunction<ExchangeFiatCodes>;
  }

  validate(data: unknown): ExchangeFiatCodes {
    this.genericValidator.execute(this.isValidExchangeFiatCodes, data);
    return data as ExchangeFiatCodes;
  }
}
