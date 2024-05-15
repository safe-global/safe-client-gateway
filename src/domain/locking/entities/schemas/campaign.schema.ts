import { ActivityMetadataSchema } from '@/domain/locking/entities/activity-metadata.entity';
import { z } from 'zod';

export const CampaignSchema = z.object({
  campaignId: z.string(),
  name: z.string(),
  description: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  lastUpdated: z.coerce.date(),
  activitiesMetadata: z.array(ActivityMetadataSchema).nullish().default(null),
});
