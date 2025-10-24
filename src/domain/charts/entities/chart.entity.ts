import { z } from 'zod';

export const ChartStatsSchema = z.object({
  first: z.number(),
  min: z.number(),
  avg: z.number(),
  max: z.number(),
  last: z.number(),
});

export const ChartPointSchema = z.tuple([z.number(), z.number()]);

export const ChartSchema = z.object({
  beginAt: z.string(),
  endAt: z.string(),
  stats: ChartStatsSchema,
  points: z.array(ChartPointSchema),
});

export type ChartStats = z.infer<typeof ChartStatsSchema>;
export type ChartPoint = z.infer<typeof ChartPointSchema>;
export type Chart = z.infer<typeof ChartSchema>;

export enum ChartPeriod {
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  THREE_MONTHS = '3months',
  YEAR = 'year',
  MAX = 'max',
}
