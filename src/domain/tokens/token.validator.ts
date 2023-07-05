import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../validation/providers/json-schema.service';
import { Page } from '../entities/page.entity';
import { IPageValidator } from '../interfaces/page-validator.interface';
import { IValidator } from '../interfaces/validator.interface';
import { tokenPageSchema, tokenSchema } from './entities/schemas/token.schema';
import { Token } from './entities/token.entity';

@Injectable()
export class TokenValidator
  implements IValidator<Token>, IPageValidator<Token>
{
  private readonly isValidToken: ValidateFunction<Token>;
  private readonly isValidPage: ValidateFunction<Page<Token>>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaValidator: JsonSchemaService,
  ) {
    this.isValidToken = this.jsonSchemaValidator.getSchema(
      'https://safe-client.safe.global/schemas/tokens/token.json',
      tokenSchema,
    );
    this.isValidPage = this.jsonSchemaValidator.getSchema(
      'https://safe-client.safe.global/schemas/tokens/token-page.json',
      tokenPageSchema,
    );
  }

  validate(data: unknown): Token {
    return this.genericValidator.validate(this.isValidToken, data);
  }

  validatePage(data: unknown): Page<Token> {
    return this.genericValidator.validate(this.isValidPage, data);
  }
}
