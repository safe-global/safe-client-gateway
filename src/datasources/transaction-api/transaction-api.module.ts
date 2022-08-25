import { Module } from '@nestjs/common';
import { ConfigApiModule } from '../config-api/config-api.module';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { TransactionApiManager } from './transaction-api.manager';

@Module({
  imports: [ConfigApiModule],
  providers: [TransactionApiManager, HttpErrorHandler],
  exports: [TransactionApiManager],
})
export class TransactionApiModule {}
