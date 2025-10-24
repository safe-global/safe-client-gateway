import { faker } from '@faker-js/faker';
import { Builder, type IBuilder } from '@/__tests__/builder';
import type {
  ZerionChartResponse,
  ZerionChartData,
  ZerionChartAttributes,
  ZerionChartStats,
  ZerionChartPoint,
} from '@/datasources/charts-api/entities/zerion-chart.entity';

export function zerionChartStatsBuilder(): IBuilder<ZerionChartStats> {
  const first = faker.number.float({ min: 1, max: 10000, multipleOf: 0.01 });
  const last = faker.number.float({ min: 1, max: 10000, multipleOf: 0.01 });
  const min = Math.min(first, last) * 0.95;
  const max = Math.max(first, last) * 1.05;
  const avg = (min + max) / 2;

  return new Builder<ZerionChartStats>()
    .with('first', first)
    .with('min', min)
    .with('avg', avg)
    .with('max', max)
    .with('last', last);
}

export function zerionChartPointBuilder(): ZerionChartPoint {
  const timestamp = faker.date.recent({ days: 30 }).getTime() / 1000;
  const price = faker.number.float({ min: 1, max: 10000, multipleOf: 0.01 });
  return [Math.floor(timestamp), price];
}

export function zerionChartAttributesBuilder(): IBuilder<ZerionChartAttributes> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const points: Array<ZerionChartPoint> = Array.from({ length: 24 }, (_, i) => {
    const timestamp = dayAgo.getTime() / 1000 + i * 3600;
    const price = faker.number.float({ min: 1, max: 10000, multipleOf: 0.01 });
    return [Math.floor(timestamp), price];
  });

  return new Builder<ZerionChartAttributes>()
    .with('begin_at', dayAgo.toISOString())
    .with('end_at', now.toISOString())
    .with('stats', zerionChartStatsBuilder().build())
    .with('points', points);
}

export function zerionChartDataBuilder(): IBuilder<ZerionChartData> {
  return new Builder<ZerionChartData>()
    .with('type', 'fungible_charts')
    .with('id', faker.string.uuid())
    .with('attributes', zerionChartAttributesBuilder().build());
}

export function zerionChartResponseBuilder(): IBuilder<ZerionChartResponse> {
  const fungibleId = faker.helpers.arrayElement(['eth', 'btc', 'usdc']);
  const period = faker.helpers.arrayElement([
    'hour',
    'day',
    'week',
    'month',
    '3months',
    'year',
    'max',
  ]);

  return new Builder<ZerionChartResponse>()
    .with('links', {
      self: `https://api.zerion.io/v1/fungibles/${fungibleId}/charts/${period}`,
    })
    .with('data', zerionChartDataBuilder().build());
}
