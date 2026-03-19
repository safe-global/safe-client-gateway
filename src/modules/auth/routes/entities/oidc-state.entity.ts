import { z } from 'zod';

export const OidcStateSchema = z.object({
  csrf: z.string(),
  redirectUrl: z.string().optional(),
});

export type OidcState = z.infer<typeof OidcStateSchema>;
