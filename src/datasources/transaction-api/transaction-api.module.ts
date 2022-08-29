import { Module } from '@nestjs/common';
import { ConfigApiModule } from '../config-api/config-api.module';
import { TransactionApiManager } from './transaction-api.manager';
import { CacheFirstDataSourceModule } from '../cache/cache.first.data.source.module';

@Module({
  imports: [ConfigApiModule, CacheFirstDataSourceModule],
  providers: [TransactionApiManager],
  exports: [TransactionApiManager],
})
export class TransactionApiModule {}
