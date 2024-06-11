import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { z } from 'zod';

export const CampaignActivitySchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  boost: z.number(),
  totalPoints: z.number(),
  totalBoostedPoints: z.number(),
});

export const CampaignActivityPageSchema = buildPageSchema(
  CampaignActivitySchema,
);

export type CampaignActivity = z.infer<typeof CampaignActivitySchema>;
