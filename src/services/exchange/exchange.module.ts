import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from '../../config/configuration';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { ExchangeService } from './exchange.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
    }),
  ],
  providers: [HttpErrorHandler, ExchangeService],
  exports: [ExchangeService],
})
export class ExchangeModule {}
