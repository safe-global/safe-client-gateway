import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../validation/providers/json-schema.service';
import { IValidator } from '../interfaces/validator.interface';
import { Safe } from './entities/safe.entity';
import { SAFE_SCHEMA_ID, safeSchema } from './entities/schemas/safe.schema';

@Injectable()
export class SafeValidator implements IValidator<Safe> {
  private readonly isValidSafe: ValidateFunction<Safe>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidSafe = this.jsonSchemaService.getSchema(
      SAFE_SCHEMA_ID,
      safeSchema,
    );
  }

  validate(data: unknown): Safe {
    return this.genericValidator.validate(this.isValidSafe, data);
  }
}
