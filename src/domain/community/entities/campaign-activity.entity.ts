import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export const CampaignActivitySchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  holder: AddressSchema,
  boost: z.coerce.number(),
  totalPoints: z.coerce.number(),
  totalBoostedPoints: z.coerce.number(),
});

export const CampaignActivityPageSchema = buildPageSchema(
  CampaignActivitySchema,
);

export type CampaignActivity = z.infer<typeof CampaignActivitySchema>;
