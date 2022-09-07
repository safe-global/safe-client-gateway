import { Global, Module } from '@nestjs/common';
import { TransactionApiManager } from './transaction-api.manager';
import { CacheFirstDataSourceModule } from '../cache/cache.first.data.source.module';
import { ITransactionApiManager } from '../../domain/interfaces/transaction-api.manager.interface';

@Global()
@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [
    { provide: ITransactionApiManager, useClass: TransactionApiManager },
  ],
  exports: [ITransactionApiManager],
})
export class TransactionApiModule {}
