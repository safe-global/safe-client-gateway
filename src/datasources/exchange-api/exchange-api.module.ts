import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { ExchangeApi } from './exchange-api.service';
import { ValidationErrorFactory } from '../errors/validation-error-factory'

@Module({
  providers: [HttpErrorFactory, ExchangeApi, ValidationErrorFactory],
  exports: [ExchangeApi],
})
export class ExchangeApiModule {}
