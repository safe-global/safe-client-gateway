import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { FiatCodes } from './entities/fiat-codes.entity';
import {
  FIAT_CODES_SCHEMA_ID,
  fiatCodesSchema,
} from './entities/schemas/fiat-codes.schema';

@Injectable()
export class FiatCodesValidator implements IValidator<FiatCodes> {
  private readonly isValidFiatCodes: ValidateFunction<FiatCodes>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaValidator: JsonSchemaService,
  ) {
    this.isValidFiatCodes = this.jsonSchemaValidator.getSchema(
      FIAT_CODES_SCHEMA_ID,
      fiatCodesSchema,
    );
  }

  validate(data: unknown): FiatCodes {
    return this.genericValidator.validate(this.isValidFiatCodes, data);
  }
}
