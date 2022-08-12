import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { SafeConfigModule } from '../safe-config/safe-config.module';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { TransactionServiceManager } from './transaction-service.manager';

@Module({
  imports: [SafeConfigModule, HttpModule],
  providers: [TransactionServiceManager, HttpErrorHandler],
  exports: [TransactionServiceManager],
})
export class TransactionServiceModule {}
