import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import { safeListSchema } from './entities/schemas/safe-list.schema';
import { SafeList } from './entities/safe-list.entity';

@Injectable()
export class SafeListValidator implements IValidator<SafeList> {
  private readonly isValidSafesList: ValidateFunction<SafeList>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValidSafesList = this.jsonSchemaService.compile(
      safeListSchema,
    ) as ValidateFunction<SafeList>;
  }

  validate(data: unknown): SafeList {
    return this.genericValidator.validate(this.isValidSafesList, data);
  }
}
