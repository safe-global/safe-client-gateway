import { Global, Module } from '@nestjs/common';
import { TransactionApiManager } from './transaction-api.manager';
import { CacheFirstDataSourceModule } from '../cache/cache.first.data.source.module';
import { ITransactionApiManager } from '../../domain/interfaces/transaction-api.manager.interface';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { PromiseRegistryModule } from '../promise/promise-registry.module';

@Global()
@Module({
  imports: [CacheFirstDataSourceModule, PromiseRegistryModule],
  providers: [
    HttpErrorFactory,
    { provide: ITransactionApiManager, useClass: TransactionApiManager },
  ],
  exports: [ITransactionApiManager],
})
export class TransactionApiModule {}
