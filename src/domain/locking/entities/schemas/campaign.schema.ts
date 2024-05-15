import { ActivityMetadataSchema } from '@/domain/locking/entities/schemas/activity-metadata.schema';
import { z } from 'zod';

export const CampaignSchema = z.object({
  campaignId: z.string(),
  name: z.string(),
  description: z.string(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  lastUpdated: z.coerce.date(),
  activities: z.array(ActivityMetadataSchema).nullish().default(null),
});
