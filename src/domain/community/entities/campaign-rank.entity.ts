import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';

export const CampaignRankSchema = z.object({
  holder: AddressSchema,
  position: z.number(),
  boost: NumericStringSchema,
  points: NumericStringSchema,
  boostedPoints: NumericStringSchema,
});

export const CampaignRankPageSchema = buildPageSchema(CampaignRankSchema);

export type CampaignRank = z.infer<typeof CampaignRankSchema>;
