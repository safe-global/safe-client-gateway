import { z } from 'zod';

export const ZerionWalletChartStatsSchema = z.object({
  first: z.number(),
  min: z.number(),
  avg: z.number(),
  max: z.number(),
  last: z.number(),
});

export const ZerionWalletChartPointSchema = z.tuple([z.number(), z.number()]);

export const ZerionWalletChartAttributesSchema = z.object({
  begin_at: z.string(),
  end_at: z.string(),
  points: z.array(ZerionWalletChartPointSchema),
});

export const ZerionWalletChartDataSchema = z.object({
  type: z.literal('wallet_chart'),
  id: z.string(),
  attributes: ZerionWalletChartAttributesSchema,
});

export const ZerionWalletChartResponseSchema = z.object({
  links: z.object({
    self: z.string(),
  }),
  data: ZerionWalletChartDataSchema,
});

export type ZerionWalletChartStats = z.infer<
  typeof ZerionWalletChartStatsSchema
>;
export type ZerionWalletChartPoint = z.infer<
  typeof ZerionWalletChartPointSchema
>;
export type ZerionWalletChartAttributes = z.infer<
  typeof ZerionWalletChartAttributesSchema
>;
export type ZerionWalletChartData = z.infer<
  typeof ZerionWalletChartDataSchema
>;
export type ZerionWalletChartResponse = z.infer<
  typeof ZerionWalletChartResponseSchema
>;
