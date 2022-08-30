import { Module } from '@nestjs/common';
import { ConfigApiModule } from '../config-api/config-api.module';
import { TransactionApiManager } from './transaction-api.manager';
import { CacheFirstDataSourceModule } from '../cache/cache.first.data.source.module';
import { ValidationErrorFactory } from '../errors/validation-error-factory';

@Module({
  imports: [ConfigApiModule, CacheFirstDataSourceModule],
  providers: [TransactionApiManager, ValidationErrorFactory],
  exports: [TransactionApiManager],
})
export class TransactionApiModule {}
