import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { GenericValidator } from '../schema/generic.validator';
import { JsonSchemaService } from '../schema/json-schema.service';
import { tokenSchema } from './entities/schemas/token.schema';
import { Token } from './entities/token.entity';

@Injectable()
export class TokenValidator implements IValidator<Token> {
  private readonly isValidToken: ValidateFunction<Token>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaValidator: JsonSchemaService,
  ) {
    this.isValidToken = this.jsonSchemaValidator.compile(
      tokenSchema,
    ) as ValidateFunction<Token>;
  }

  validate(data: unknown): Token {
    return this.genericValidator.validate(this.isValidToken, data);
  }
}
