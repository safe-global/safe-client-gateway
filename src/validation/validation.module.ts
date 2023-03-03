import { Global, Module } from '@nestjs/common';
import { GenericValidator } from './providers/generic.validator';
import { JsonSchemaService } from './providers/json-schema.service';
import { ValidationErrorFactory } from './providers/validation-error-factory';

@Global()
@Module({
  providers: [JsonSchemaService, GenericValidator, ValidationErrorFactory],
  exports: [JsonSchemaService, GenericValidator, ValidationErrorFactory],
})
export class ValidationModule {}
