import { Module } from '@nestjs/common';
import { ConfigServiceModule } from '../config-service/config-service.module';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { TransactionApiManager } from './transaction-api.manager';

@Module({
  imports: [ConfigServiceModule],
  providers: [TransactionApiManager, HttpErrorHandler],
  exports: [TransactionApiManager],
})
export class TransactionApiModule {}
