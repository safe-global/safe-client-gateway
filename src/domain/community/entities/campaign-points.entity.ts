import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { z } from 'zod';

export const CampaignPointsSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  boost: z.number(),
  totalPoints: z.number(),
  totalBoostedPoints: z.number(),
});

export const CampaignPointsPageSchema = buildPageSchema(CampaignPointsSchema);

export type CampaignPoints = z.infer<typeof CampaignPointsSchema>;
