import { Module } from '@nestjs/common';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { ExchangeApi } from './exchange-api.service';

@Module({
  providers: [HttpErrorHandler, ExchangeApi],
  exports: [ExchangeApi],
})
export class ExchangeApiModule {}
