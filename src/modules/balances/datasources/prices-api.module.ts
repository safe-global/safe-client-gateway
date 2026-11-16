// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { CacheFirstDataSourceModule } from '#/datasources/cache/cache.first.data.source.module';
import { HttpErrorFactory } from '#/datasources/errors/http-error-factory';
import { CoingeckoApi } from '#/modules/balances/datasources/coingecko-api.service';
import { IPricesApi } from '#/modules/balances/datasources/prices-api.interface';

@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [
    HttpErrorFactory,
    { provide: IPricesApi, useClass: CoingeckoApi },
  ],
  exports: [IPricesApi],
})
export class PricesApiModule {}
