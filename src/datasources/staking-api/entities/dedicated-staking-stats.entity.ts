import { z } from 'zod';

export const DedicatedStakingStatsSchema = z.object({
  gross_apy: z.object({
    last_1d: z.number(),
    last_7d: z.number(),
    last_30d: z.number(),
  }),
  updated_at: z.coerce.date(),
});

export type DedicatedStakingStats = z.infer<typeof DedicatedStakingStatsSchema>;
