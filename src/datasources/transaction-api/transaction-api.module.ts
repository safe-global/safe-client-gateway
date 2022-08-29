import { Module } from '@nestjs/common';
import { ConfigApiModule } from '../config-api/config-api.module';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { TransactionApiManager } from './transaction-api.manager';

@Module({
  imports: [ConfigApiModule],
  providers: [TransactionApiManager, HttpErrorFactory],
  exports: [TransactionApiManager],
})
export class TransactionApiModule {}
