import { z } from 'zod';

export type ActivityMetadata = z.infer<typeof ActivityMetadataSchema>;

export const ActivityMetadataSchema = z.object({
  name: z.string(),
  description: z.string(),
  maxPoints: z.number(),
});
