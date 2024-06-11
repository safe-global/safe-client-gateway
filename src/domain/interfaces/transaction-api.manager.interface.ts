import { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import { Module } from '@nestjs/common';
import { TransactionApiManager } from '@/datasources/transaction-api/transaction-api.manager';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { IApiManager } from '@/domain/interfaces/api.manager.interface';

export const ITransactionApiManager = Symbol('ITransactionApiManager');

export interface ITransactionApiManager extends IApiManager<ITransactionApi> {}

@Module({
  imports: [CacheFirstDataSourceModule, ConfigApiModule],
  providers: [
    {
      provide: ITransactionApiManager,
      useClass: TransactionApiManager,
    },
    HttpErrorFactory,
  ],
  exports: [ITransactionApiManager],
})
export class TransactionApiManagerModule {}
