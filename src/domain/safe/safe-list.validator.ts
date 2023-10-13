import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '@/domain/interfaces/validator.interface';
import { SafeList } from '@/domain/safe/entities/safe-list.entity';
import {
  SAFE_LIST_SCHEMA_ID,
  safeListSchema,
} from '@/domain/safe/entities/schemas/safe-list.schema';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';

@Injectable()
export class SafeListValidator implements IValidator<SafeList> {
  private readonly isValidSafesList: ValidateFunction<SafeList>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidSafesList = this.jsonSchemaService.getSchema(
      SAFE_LIST_SCHEMA_ID,
      safeListSchema,
    );
  }

  validate(data: unknown): SafeList {
    return this.genericValidator.validate(this.isValidSafesList, data);
  }
}
