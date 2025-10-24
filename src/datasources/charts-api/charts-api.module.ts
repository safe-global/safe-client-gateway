import { Module } from '@nestjs/common';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import {
  IChartApi,
  ZerionChartApi,
} from '@/datasources/charts-api/zerion-chart-api.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';

export const ZERION_CHART_API = Symbol('ZerionChartApi');

@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [
    HttpErrorFactory,
    { provide: IChartApi, useClass: ZerionChartApi }, // Default
    { provide: ZERION_CHART_API, useClass: ZerionChartApi }, // Named
  ],
  exports: [IChartApi, ZERION_CHART_API],
})
export class ChartsApiModule {}
