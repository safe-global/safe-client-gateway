import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { ExchangeApi } from './exchange-api.service';

@Module({
  providers: [HttpErrorFactory, ExchangeApi],
  exports: [ExchangeApi],
})
export class ExchangeApiModule {}
