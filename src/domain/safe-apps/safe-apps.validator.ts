import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { GenericValidator } from '../schema/generic.validator';
import { JsonSchemaService } from '../schema/json-schema.service';
import { SafeApp } from './entities/safe-app.entity';
import {
  safeAppAccessControlSchema,
  safeAppProviderSchema,
  safeAppSchema,
} from './entities/schemas/safe-app.schema';

@Injectable()
export class SafeAppsValidator implements IValidator<SafeApp> {
  private readonly isValidSafeApp: ValidateFunction<SafeApp>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.jsonSchemaService.addSchema(
      safeAppProviderSchema,
      'safeAppProviderSchema',
    );
    this.jsonSchemaService.addSchema(
      safeAppAccessControlSchema,
      'safeAppAccessControlSchema',
    );
    this.isValidSafeApp = this.jsonSchemaService.compile(safeAppSchema);
  }

  validate(data: unknown): SafeApp {
    return this.genericValidator.validate(this.isValidSafeApp, data);
  }
}
