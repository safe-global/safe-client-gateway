import { Module } from '@nestjs/common';
import { CacheFirstDataSourceModule } from '../cache/cache.first.data.source.module';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { CoingeckoApi } from './coingecko-api.service';
import { IPricesApi } from '@/domain/interfaces/prices-api.interface';

// TODO: remove
@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [
    HttpErrorFactory,
    { provide: IPricesApi, useClass: CoingeckoApi },
  ],
  exports: [IPricesApi],
})
export class PricesApiModule {}
