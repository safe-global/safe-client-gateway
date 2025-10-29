import { ApiProperty } from '@nestjs/swagger';
import type { WalletChart as DomainWalletChart } from '@/domain/charts/entities/wallet-chart.entity';
import type { ChartPoint as DomainChartPoint } from '@/domain/charts/entities/chart.entity';

export class WalletChart implements DomainWalletChart {
  @ApiProperty({
    description: 'Start timestamp of the chart period (ISO 8601)',
    type: 'string',
  })
  beginAt!: string;

  @ApiProperty({
    description: 'End timestamp of the chart period (ISO 8601)',
    type: 'string',
  })
  endAt!: string;

  @ApiProperty({
    description:
      'Array of portfolio value data points. Each point is a tuple of [timestamp (Unix seconds), value in fiat currency]',
    type: 'array',
    items: {
      type: 'array',
      items: { type: 'number' },
    },
  })
  points!: Array<DomainChartPoint>;

  constructor(chart: DomainWalletChart) {
    this.beginAt = chart.beginAt;
    this.endAt = chart.endAt;
    this.points = chart.points;
  }
}
