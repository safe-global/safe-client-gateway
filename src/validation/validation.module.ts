import { Global, Module } from '@nestjs/common';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import { ValidationErrorFactory } from '@/validation/providers/validation-error-factory';

@Global()
@Module({
  providers: [JsonSchemaService, GenericValidator, ValidationErrorFactory],
  exports: [JsonSchemaService, GenericValidator, ValidationErrorFactory],
})
export class ValidationModule {}
