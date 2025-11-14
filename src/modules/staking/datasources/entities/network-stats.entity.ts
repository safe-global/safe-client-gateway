import { z } from 'zod';

export const NetworkStatsSchema = z.object({
  eth_price_usd: z.number(),
  nb_validators: z.number(),
  network_gross_apy: z.number(),
  supply_staked_percent: z.number(),
  estimated_entry_time_seconds: z.number(),
  estimated_exit_time_seconds: z.number(),
  estimated_withdrawal_time_seconds: z.number(),
  updated_at: z.coerce.date(),
});

export type NetworkStats = z.infer<typeof NetworkStatsSchema>;
