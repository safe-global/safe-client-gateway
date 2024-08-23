import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { ActivityMetadataSchema } from '@/domain/community/entities/activity-metadata.entity';
import { z } from 'zod';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

export type Campaign = z.infer<typeof CampaignSchema>;

export const CampaignSchema = z.object({
  resourceId: z.string(),
  name: z.string(),
  description: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  lastUpdated: z.coerce.date().nullish().default(null),
  activitiesMetadata: z.array(ActivityMetadataSchema).nullish().default(null),
  rewardValue: NumericStringSchema.nullish().default(null),
  rewardText: z.string().nullish().default(null),
  iconUrl: z.string().url().nullish().default(null),
  safeAppUrl: z.string().url().nullish().default(null),
  partnerUrl: z.string().url().nullish().default(null),
  isPromoted: z.boolean(),
});

export const CampaignPageSchema = buildPageSchema(CampaignSchema);
