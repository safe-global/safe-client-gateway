import { Module } from '@nestjs/common';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  IValkBalancesApi,
  ValkBalancesApi,
} from '@/datasources/balances-api/valk-balances-api.service';

@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [
    HttpErrorFactory,
    { provide: IValkBalancesApi, useClass: ValkBalancesApi },
  ],
  exports: [IValkBalancesApi],
})
export class BalancesApiModule {}
