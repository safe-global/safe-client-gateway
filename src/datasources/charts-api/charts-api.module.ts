import { Module } from '@nestjs/common';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import {
  IChartApi,
  ZerionChartApi,
} from '@/datasources/charts-api/zerion-chart-api.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';

@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [
    HttpErrorFactory,
    { provide: IChartApi, useClass: ZerionChartApi },
  ],
  exports: [IChartApi],
})
export class ChartsApiModule {}
