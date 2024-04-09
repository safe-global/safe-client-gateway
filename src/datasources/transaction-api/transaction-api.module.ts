import { Module } from '@nestjs/common';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { TransactionApiManager } from '@/datasources/transaction-api/transaction-api.manager';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';

@Module({
  imports: [CacheFirstDataSourceModule, ConfigApiModule],
  providers: [
    HttpErrorFactory,
    { provide: ITransactionApiManager, useClass: TransactionApiManager },
  ],
  exports: [ITransactionApiManager],
})
export class TransactionApiModule {}
