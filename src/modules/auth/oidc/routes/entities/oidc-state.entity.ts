// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export const OidcStateSchema = z.object({
  csrf: z.hex().length(64),
  redirectUrl: z.string().min(1).max(2048).optional(),
  // Marks an authenticator-enrollment round-trip: the provider challenges an
  // existing factor and enrolls a new authenticator; the callback then
  // removes superseded ones.
  enroll: z.boolean().optional(),
  // Marks a step-up round-trip: the callback must verify that the returned
  // token proves a fresh multi-factor challenge before elevating the session.
  elevate: z.boolean().optional(),
});

export type OidcState = z.infer<typeof OidcStateSchema>;
