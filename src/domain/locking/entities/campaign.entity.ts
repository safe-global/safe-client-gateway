import { z } from 'zod';

export type Campaign = z.infer<typeof CampaignSchema>;

export const CampaignSchema = z.object({
  campaignId: z.string(),
  name: z.string(),
  description: z.string(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  lastUpdated: z.coerce.date(),
  // TODO: include 'activities' field once the structure is defined.
});
