import { Global, Module } from '@nestjs/common';
import { CacheFirstDataSourceModule } from '../cache/cache.first.data.source.module';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { IPricesApi } from '../../domain/interfaces/prices-api.interface';
import { PricesApi } from './prices-api.service';

@Global()
@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [HttpErrorFactory, { provide: IPricesApi, useClass: PricesApi }],
  exports: [IPricesApi],
})
export class PricesApiModule {}
