import { z } from 'zod';

export const EligibilitySchema = z.object({
  requestId: z.string(),
  isAllowed: z.boolean(),
  isVpn: z.boolean(),
});

export type Eligibility = z.infer<typeof EligibilitySchema>;
