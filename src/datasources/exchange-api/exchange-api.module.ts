import { Global, Module } from '@nestjs/common';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { ExchangeApi } from './exchange-api.service';
import { IExchangeApi } from '../../domain/interfaces/exchange-api.interface';
import { CacheFirstDataSourceModule } from '../cache/cache.first.data.source.module';

@Global()
@Module({
  exports: [IExchangeApi],
  imports: [CacheFirstDataSourceModule],
  providers: [
    HttpErrorFactory,
    { provide: IExchangeApi, useClass: ExchangeApi },
  ],
})
export class ExchangeApiModule {}
