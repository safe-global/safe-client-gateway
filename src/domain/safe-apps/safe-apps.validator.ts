import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../validation/providers/json-schema.service';
import { IValidator } from '../interfaces/validator.interface';
import { SafeApp } from './entities/safe-app.entity';
import {
  SAFE_APP_SCHEMA_ID,
  SAFE_APP_ACCESS_CONTROL_SCHEMA_ID,
  SAFE_APP_PROVIDER_SCHEMA_ID,
  SAFE_APP_SOCIAL_PROFILE_SCHEMA_ID,
  safeAppAccessControlSchema,
  safeAppProviderSchema,
  safeAppSchema,
  safeAppSocialProfileSchema,
} from './entities/schemas/safe-app.schema';

@Injectable()
export class SafeAppsValidator implements IValidator<SafeApp> {
  private readonly isValidSafeApp: ValidateFunction<SafeApp>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.jsonSchemaService.getSchema(
      SAFE_APP_PROVIDER_SCHEMA_ID,
      safeAppProviderSchema,
    );

    this.jsonSchemaService.getSchema(
      SAFE_APP_ACCESS_CONTROL_SCHEMA_ID,
      safeAppAccessControlSchema,
    );

    this.jsonSchemaService.getSchema(
      SAFE_APP_SOCIAL_PROFILE_SCHEMA_ID,
      safeAppSocialProfileSchema,
    );

    this.isValidSafeApp = this.jsonSchemaService.getSchema(
      SAFE_APP_SCHEMA_ID,
      safeAppSchema,
    );
  }

  validate(data: unknown): SafeApp {
    return this.genericValidator.validate(this.isValidSafeApp, data);
  }
}
