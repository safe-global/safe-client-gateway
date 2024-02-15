import { Module } from '@nestjs/common';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import { BalancesApiManager } from '@/datasources/balances-api/balances-api.manager';
import { IBalancesApiManager } from '@/domain/interfaces/balances-api.manager.interface';
import {
  IValkBalancesApi,
  ValkBalancesApi,
} from '@/datasources/balances-api/valk-balances-api.service';
import {
  IZerionBalancesApi,
  ZerionBalancesApi,
} from '@/datasources/balances-api/zerion-balances-api.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';

@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [
    HttpErrorFactory,
    { provide: IBalancesApiManager, useClass: BalancesApiManager },
    { provide: IValkBalancesApi, useClass: ValkBalancesApi },
    { provide: IZerionBalancesApi, useClass: ZerionBalancesApi },
  ],
  exports: [IBalancesApiManager],
})
export class BalancesApiModule {}
