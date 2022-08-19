import { Module } from '@nestjs/common';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { ExchangeService } from './exchange.service';

@Module({
  providers: [HttpErrorHandler, ExchangeService],
  exports: [ExchangeService],
})
export class ExchangeModule {}
