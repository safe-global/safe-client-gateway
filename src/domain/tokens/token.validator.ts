import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../validation/providers/json-schema.service';
import { IValidator } from '../interfaces/validator.interface';
import { tokenSchema } from './entities/schemas/token.schema';
import { Token } from './entities/token.entity';

@Injectable()
export class TokenValidator implements IValidator<Token> {
  private readonly isValidToken: ValidateFunction<Token>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaValidator: JsonSchemaService,
  ) {
    this.isValidToken = this.jsonSchemaValidator.getSchema(
      'https://safe-client.safe.global/schemas/tokens/token.json',
      tokenSchema,
    );
  }

  validate(data: unknown): Token {
    return this.genericValidator.validate(this.isValidToken, data);
  }
}
