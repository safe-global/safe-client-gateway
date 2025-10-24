import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IChartApi } from '@/datasources/charts-api/zerion-chart-api.service';
import { ZerionChartApi } from '@/datasources/charts-api/zerion-chart-api.service';

@Module({
  providers: [
    HttpErrorFactory,
    { provide: IChartApi, useClass: ZerionChartApi },
  ],
  exports: [IChartApi],
})
export class TestChartsApiModule {}
