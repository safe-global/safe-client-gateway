import { Global, Module } from '@nestjs/common';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { ExchangeApi } from './exchange-api.service';
import { IExchangeApi } from '../../domain/interfaces/exchange-api.interface';
import { ValidationErrorFactory } from '../errors/validation-error-factory';
import { JsonSchemaService } from '../../common/schemas/json-schema.service';

@Global()
@Module({
  providers: [
    HttpErrorFactory,
    { provide: IExchangeApi, useClass: ExchangeApi },
    JsonSchemaService,
    ValidationErrorFactory,
  ],
  exports: [IExchangeApi],
})
export class ExchangeApiModule {}
