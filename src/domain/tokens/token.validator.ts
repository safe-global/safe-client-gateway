import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { Page } from '@/domain/entities/page.entity';
import { IPageValidator } from '@/domain/interfaces/page-validator.interface';
import { IValidator } from '@/domain/interfaces/validator.interface';
import {
  TOKEN_PAGE_SCHEMA_ID,
  TOKEN_SCHEMA_ID,
  tokenPageSchema,
  tokenSchema,
} from '@/domain/tokens/entities/schemas/token.schema';
import { Token } from '@/domain/tokens/entities/token.entity';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';

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
      TOKEN_SCHEMA_ID,
      tokenSchema,
    );
    this.isValidPage = this.jsonSchemaValidator.getSchema(
      TOKEN_PAGE_SCHEMA_ID,
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
