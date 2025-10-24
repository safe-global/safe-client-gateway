import { Inject, Injectable } from '@nestjs/common';
import { IChartsRepository } from '@/domain/charts/charts.repository.interface';
import { ChartPeriod } from '@/domain/charts/entities/chart.entity';
import { Chart } from '@/routes/charts/entities/chart.entity';

@Injectable()
export class ChartsService {
  constructor(
    @Inject(IChartsRepository)
    private readonly chartsRepository: IChartsRepository,
  ) {}

  async getChart(args: {
    fungibleId: string;
    period: ChartPeriod;
    currency: string;
  }): Promise<Chart> {
    const domainChart = await this.chartsRepository.getChart(args);
    return new Chart(domainChart);
  }

  async clearChart(args: {
    fungibleId: string;
    period: ChartPeriod;
    currency: string;
  }): Promise<void> {
    await this.chartsRepository.clearChart(args);
  }
}
