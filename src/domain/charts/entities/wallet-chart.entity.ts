import { z } from 'zod';
import { ChartPointSchema } from '@/domain/charts/entities/chart.entity';

export const WalletChartSchema = z.object({
  beginAt: z.string(),
  endAt: z.string(),
  points: z.array(ChartPointSchema),
});

export type WalletChart = z.infer<typeof WalletChartSchema>;
