import { faker } from '@faker-js/faker';
import { Builder, type IBuilder } from '@/__tests__/builder';
import type {
  Chart,
  ChartStats,
  ChartPoint,
} from '@/domain/charts/entities/chart.entity';

export function chartStatsBuilder(): IBuilder<ChartStats> {
  const first = faker.number.float({ min: 1, max: 10000, multipleOf: 0.01 });
  const last = faker.number.float({ min: 1, max: 10000, multipleOf: 0.01 });
  const min = Math.min(first, last) * 0.95;
  const max = Math.max(first, last) * 1.05;
  const avg = (min + max) / 2;

  return new Builder<ChartStats>()
    .with('first', first)
    .with('min', min)
    .with('avg', avg)
    .with('max', max)
    .with('last', last);
}

export function chartPointBuilder(): ChartPoint {
  const timestamp = faker.date.recent({ days: 30 }).getTime() / 1000;
  const price = faker.number.float({ min: 1, max: 10000, multipleOf: 0.01 });
  return [Math.floor(timestamp), price];
}

export function chartBuilder(): IBuilder<Chart> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const points: Array<ChartPoint> = Array.from({ length: 24 }, (_, i) => {
    const timestamp = dayAgo.getTime() / 1000 + i * 3600;
    const price = faker.number.float({ min: 1, max: 10000, multipleOf: 0.01 });
    return [Math.floor(timestamp), price];
  });

  return new Builder<Chart>()
    .with('beginAt', dayAgo.toISOString())
    .with('endAt', now.toISOString())
    .with('stats', chartStatsBuilder().build())
    .with('points', points);
}
