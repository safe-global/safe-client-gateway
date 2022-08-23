import { Module } from '@nestjs/common';
import { ConfigApiModule } from '../config-api/config-api.module';
import { TransactionApiManager } from './transaction-api.manager';
import { CacheFirstDataSourceModule } from '../cache/cacheFirstDataSourceModule';

@Module({
  imports: [ConfigApiModule, CacheFirstDataSourceModule],
  providers: [TransactionApiManager],
  exports: [TransactionApiManager],
})
export class TransactionApiModule {}
