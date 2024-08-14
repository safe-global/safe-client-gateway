import { z } from 'zod';

export const KilnStatsSchema = z.object({
  gross_apy: z.object({
    last_1d: z.number(),
    last_7d: z.number(),
    last_30d: z.number(),
  }),
  updated_at: z.coerce.date(),
});

export type KilnStats = z.infer<typeof KilnStatsSchema>;
