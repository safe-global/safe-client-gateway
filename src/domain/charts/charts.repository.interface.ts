import type { Chart, ChartPeriod } from '@/domain/charts/entities/chart.entity';

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
