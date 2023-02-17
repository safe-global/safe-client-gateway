import { Module } from '@nestjs/common';
import { GenericValidator } from './domain/schema/generic.validator';
import { JsonSchemaService } from './domain/schema/json-schema.service';
import { ValidationErrorFactory } from './domain/schema/validation-error-factory';

@Module({
  providers: [JsonSchemaService, GenericValidator, ValidationErrorFactory],
  exports: [JsonSchemaService, GenericValidator, ValidationErrorFactory],
})
export class ValidationModule {}
