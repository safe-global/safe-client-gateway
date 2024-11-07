import { z } from 'zod';

export const EligibilityRequestSchema = z.object({
  requestId: z.string(),
  sealedData: z.string(),
});

export type EligibilityRequest = z.infer<typeof EligibilityRequestSchema>;
