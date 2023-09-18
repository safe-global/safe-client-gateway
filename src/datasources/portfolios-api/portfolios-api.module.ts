import { IPortfoliosApi } from '@/domain/interfaces/portfolios-api.interface';
import { Global, Module } from '@nestjs/common';
import { CacheFirstDataSourceModule } from '../cache/cache.first.data.source.module';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { PortfoliosApi } from './portfolios-api.service';

@Global()
@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [
    HttpErrorFactory,
    { provide: IPortfoliosApi, useClass: PortfoliosApi },
  ],
  exports: [IPortfoliosApi],
})
export class PortfoliosApiModule {}
