import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigServiceModule } from '../config-service/config-service.module';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { TransactionServiceManager } from './transaction-service.manager';

@Module({
  imports: [ConfigServiceModule, HttpModule],
  providers: [TransactionServiceManager, HttpErrorHandler],
  exports: [TransactionServiceManager],
})
export class TransactionServiceModule {}
