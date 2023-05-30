import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '../../validation/providers/generic.validator';
import { JsonSchemaService } from '../../validation/providers/json-schema.service';
import { IValidator } from '../interfaces/validator.interface';
import { SafeApp } from './entities/safe-app.entity';
import {
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
      'https://safe-client.safe.global/schemas/safe-apps/safe-app-provider.json',
      safeAppProviderSchema,
    );

    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/safe-apps/safe-app-access-control.json',
      safeAppAccessControlSchema,
    );

    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/safe-apps/safe-app-social-profile.json',
      safeAppSocialProfileSchema,
    );

    this.isValidSafeApp = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/safe-apps/safe-app.json',
      safeAppSchema,
    );
  }

  validate(data: unknown): SafeApp {
    return this.genericValidator.validate(this.isValidSafeApp, data);
  }
}
