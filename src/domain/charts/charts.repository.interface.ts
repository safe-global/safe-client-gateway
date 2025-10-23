import { Module } from '@nestjs/common';
import type { Chart, ChartPeriod } from '@/domain/charts/entities/chart.entity';
import { ChartsRepository } from '@/domain/charts/charts.repository';
import { ChartsApiModule } from '@/datasources/charts-api/charts-api.module';

export const IChartsRepository = Symbol('IChartsRepository');

export interface IChartsRepository {
  getChart(args: {
    fungibleId: string;
    period: ChartPeriod;
    currency: string;
  }): Promise<Chart>;

  clearChart(args: {
    fungibleId: string;
    period: ChartPeriod;
    currency: string;
  }): Promise<void>;
}

@Module({
  imports: [ChartsApiModule],
  providers: [
    {
      provide: IChartsRepository,
      useClass: ChartsRepository,
    },
  ],
  exports: [IChartsRepository],
})
export class ChartsRepositoryModule {}
