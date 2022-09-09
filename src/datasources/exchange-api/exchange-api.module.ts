import { Global, Module } from '@nestjs/common';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { ExchangeApi } from './exchange-api.service';
import { IExchangeApi } from '../../domain/interfaces/exchange-api.interface';

@Global()
@Module({
  providers: [
    HttpErrorFactory,
    { provide: IExchangeApi, useClass: ExchangeApi },
  ],
  exports: [IExchangeApi],
})
export class ExchangeApiModule {}
