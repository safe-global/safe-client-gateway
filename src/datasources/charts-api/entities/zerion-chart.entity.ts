import { z } from 'zod';

export const ZerionChartStatsSchema = z.object({
  first: z.number(),
  min: z.number(),
  avg: z.number(),
  max: z.number(),
  last: z.number(),
});

export const ZerionChartPointSchema = z.tuple([z.number(), z.number()]);

export const ZerionChartAttributesSchema = z.object({
  begin_at: z.string(),
  end_at: z.string(),
  stats: ZerionChartStatsSchema,
  points: z.array(ZerionChartPointSchema),
});

export const ZerionChartDataSchema = z.object({
  type: z.literal('fungible_charts'),
  id: z.string(),
  attributes: ZerionChartAttributesSchema,
});

export const ZerionChartResponseSchema = z.object({
  links: z.object({
    self: z.string(),
  }),
  data: ZerionChartDataSchema,
});

export type ZerionChartStats = z.infer<typeof ZerionChartStatsSchema>;
export type ZerionChartPoint = z.infer<typeof ZerionChartPointSchema>;
export type ZerionChartAttributes = z.infer<typeof ZerionChartAttributesSchema>;
export type ZerionChartData = z.infer<typeof ZerionChartDataSchema>;
export type ZerionChartResponse = z.infer<typeof ZerionChartResponseSchema>;
