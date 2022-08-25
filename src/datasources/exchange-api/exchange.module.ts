import { Module } from '@nestjs/common';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { ExchangeApi } from './exchange.service';

@Module({
  providers: [HttpErrorHandler, ExchangeApi],
  exports: [ExchangeApi],
})
export class ExchangeModule {}
