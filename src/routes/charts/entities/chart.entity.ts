import { ApiProperty } from '@nestjs/swagger';
import type {
  Chart as DomainChart,
  ChartStats as DomainChartStats,
  ChartPoint as DomainChartPoint,
} from '@/domain/charts/entities/chart.entity';

export class ChartStats implements DomainChartStats {
  @ApiProperty({
    description: 'First price in the period',
    example: 3456.78,
    type: 'number',
  })
  first!: number;

  @ApiProperty({
    description: 'Minimum price in the period',
    example: 3401.23,
    type: 'number',
  })
  min!: number;

  @ApiProperty({
    description: 'Average price in the period',
    example: 3478.45,
    type: 'number',
  })
  avg!: number;

  @ApiProperty({
    description: 'Maximum price in the period',
    example: 3567.89,
    type: 'number',
  })
  max!: number;

  @ApiProperty({
    description: 'Last price in the period',
    example: 3501.12,
    type: 'number',
  })
  last!: number;

  constructor(stats: DomainChartStats) {
    this.first = stats.first;
    this.min = stats.min;
    this.avg = stats.avg;
    this.max = stats.max;
    this.last = stats.last;
  }
}

export class Chart implements DomainChart {
  @ApiProperty({
    description: 'Start timestamp of the chart period (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
    type: 'string',
  })
  beginAt!: string;

  @ApiProperty({
    description: 'End timestamp of the chart period (ISO 8601)',
    example: '2024-12-31T23:59:59Z',
    type: 'string',
  })
  endAt!: string;

  @ApiProperty({
    description: 'Statistical summary of prices in the period',
    type: ChartStats,
  })
  stats!: ChartStats;

  @ApiProperty({
    description:
      'Array of price data points. Each point is a tuple of [timestamp (Unix seconds), price]',
    example: [
      [1704067200, 3456.78],
      [1704070800, 3460.23],
    ],
    type: 'array',
    items: {
      type: 'array',
      items: { type: 'number' },
    },
  })
  points!: Array<DomainChartPoint>;

  constructor(chart: DomainChart) {
    this.beginAt = chart.beginAt;
    this.endAt = chart.endAt;
    this.stats = new ChartStats(chart.stats);
    this.points = chart.points;
  }
}
