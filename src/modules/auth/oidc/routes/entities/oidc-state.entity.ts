// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export const OidcStateSchema = z.object({
  csrf: z.hex().length(64),
  redirectUrl: z.string().min(1).max(2048).optional(),
  // Marks a step-up round-trip: the callback must verify the returned token
  // carries amr=mfa and stamps mfa_verified_at into the session.
  elevate: z.boolean().optional(),
});

export type OidcState = z.infer<typeof OidcStateSchema>;
