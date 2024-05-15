import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { ActivityMetadataSchema } from '@/domain/locking/entities/activity-metadata.entity';
import { z } from 'zod';

export type Campaign = z.infer<typeof CampaignSchema>;

export const CampaignSchema = z.object({
  campaignId: z.string(),
  name: z.string(),
  description: z.string(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  lastUpdated: z.coerce.date(),
  activities: z.array(ActivityMetadataSchema).nullish().default(null),
});

export const CampaignPageSchema = buildPageSchema(CampaignSchema);
