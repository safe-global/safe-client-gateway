import { Injectable } from '@nestjs/common';
import { ValidateFunction, DefinedError } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { ValidationErrorFactory } from '../schema/validation-error-factory';
import { ExchangeFiatCodes } from './entities/exchange-fiat-codes.entity';
import { exchangeFiatCodesSchema } from './entities/schemas/exchange-fiat-codes.schema';

@Injectable()
export class ExchangeFiatCodesValidator
  implements IValidator<ExchangeFiatCodes>
{
  private readonly isValidExchangeFiatCodes: ValidateFunction<ExchangeFiatCodes>;

  constructor(
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidExchangeFiatCodes = this.jsonSchemaService.compile(
      exchangeFiatCodesSchema,
    ) as ValidateFunction<ExchangeFiatCodes>;
  }

  validate(data: unknown): ExchangeFiatCodes {
    if (!this.isValidExchangeFiatCodes(data)) {
      const errors = this.isValidExchangeFiatCodes.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return data as ExchangeFiatCodes;
  }
}
