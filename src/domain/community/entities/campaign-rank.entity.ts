import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export const CampaignRankSchema = z.object({
  holder: AddressSchema,
  position: z.number(),
  boost: z.number(),
  totalPoints: z.number(),
  totalBoostedPoints: z.number(),
});

export const CampaignRankPageSchema = buildPageSchema(CampaignRankSchema);

export type CampaignRank = z.infer<typeof CampaignRankSchema>;
