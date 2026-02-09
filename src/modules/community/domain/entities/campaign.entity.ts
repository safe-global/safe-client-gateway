import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { ActivityMetadataSchema } from '@/modules/community/domain/entities/activity-metadata.entity';
import { z } from 'zod';
import {
  NullableCoercedDateSchema,
  NullableNumericStringSchema,
  NullableStringSchema,
} from '@/validation/entities/schemas/nullable.schema';

export type Campaign = z.infer<typeof CampaignSchema>;

export const CampaignSchema = z.object({
  resourceId: z.string(),
  name: z.string(),
  description: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  lastUpdated: NullableCoercedDateSchema,
  activitiesMetadata: z.array(ActivityMetadataSchema).nullish().default(null),
  rewardValue: NullableNumericStringSchema,
  rewardText: NullableStringSchema,
  iconUrl: z.url().nullish().default(null),
  safeAppUrl: z.url().nullish().default(null),
  partnerUrl: z.url().nullish().default(null),
  isPromoted: z.boolean(),
});

export const CampaignPageSchema = buildPageSchema(CampaignSchema);
