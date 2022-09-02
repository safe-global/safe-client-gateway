import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { ExchangeApi } from './exchange-api.service';
import { ValidationErrorFactory } from '../errors/validation-error-factory';
import { JsonSchemaService } from '../common/json-schema.service';

@Module({
  providers: [
    ExchangeApi,
    HttpErrorFactory,
    JsonSchemaService,
    ValidationErrorFactory,
  ],
  exports: [ExchangeApi],
})
export class ExchangeApiModule {}
