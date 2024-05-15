import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';

export type ActivityMetadata = z.infer<typeof ActivityMetadataSchema>;

export const ActivityMetadataSchema = z.object({
  campaignId: z.string(),
  name: z.string(),
  description: z.string(),
  maxPoints: NumericStringSchema,
});
