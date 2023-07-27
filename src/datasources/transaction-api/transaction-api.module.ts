import { Global, Module } from '@nestjs/common';
import { TransactionApiManager } from './transaction-api.manager';
import { CacheFirstDataSourceModule } from '../cache/cache.first.data.source.module';
import { ITransactionApiManager } from '../../domain/interfaces/transaction-api.manager.interface';
import { HttpErrorFactory } from '../errors/http-error-factory';

@Global()
@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [
    HttpErrorFactory,
    { provide: ITransactionApiManager, useClass: TransactionApiManager },
  ],
  exports: [ITransactionApiManager],
})
export class TransactionApiModule {}
