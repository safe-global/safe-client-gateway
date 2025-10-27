import { Module } from '@nestjs/common';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import {
  IChartApi,
  ZerionChartApi,
} from '@/datasources/charts-api/zerion-chart-api.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { AssetRegistryModule } from '@/domain/common/asset-registry.module';

export const ZERION_CHART_API = Symbol('ZerionChartApi');

@Module({
  imports: [CacheFirstDataSourceModule, AssetRegistryModule],
  providers: [
    HttpErrorFactory,
    { provide: IChartApi, useClass: ZerionChartApi },
    { provide: ZERION_CHART_API, useClass: ZerionChartApi },
  ],
  exports: [IChartApi, ZERION_CHART_API],
})
export class ChartsApiModule {}
