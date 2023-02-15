import { Module } from '@nestjs/common';
import { GenericValidator } from '../../domain/schema/generic.validator';
import { JsonSchemaService } from '../../domain/schema/json-schema.service';
import { ValidationErrorFactory } from '../../domain/schema/validation-error-factory';
import { DelegatesController } from './delegates.controller';
import { DelegatesService } from './delegates.service';

@Module({
  controllers: [DelegatesController],
  providers: [
    JsonSchemaService,
    GenericValidator,
    ValidationErrorFactory,
    DelegatesService,
  ],
})
export class DelegatesModule {}
