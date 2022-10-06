import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { SimpleValidator } from '../schema/simple.validator';
import { ExchangeFiatCodes } from './entities/exchange-fiat-codes.entity';
import { exchangeFiatCodesSchema } from './entities/schemas/exchange-fiat-codes.schema';

@Injectable()
export class ExchangeFiatCodesValidator
  implements IValidator<ExchangeFiatCodes>
{
  private readonly isValidExchangeFiatCodes: ValidateFunction<ExchangeFiatCodes>;

  constructor(
    private readonly simpleValidator: SimpleValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidExchangeFiatCodes = this.jsonSchemaService.compile(
      exchangeFiatCodesSchema,
    ) as ValidateFunction<ExchangeFiatCodes>;
  }

  validate(data: unknown): ExchangeFiatCodes {
    this.simpleValidator.execute(this.isValidExchangeFiatCodes, data);
    return data as ExchangeFiatCodes;
  }
}
