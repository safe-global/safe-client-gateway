// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

/**
 * Server-side, short-lived record of an in-flight authenticator enrollment:
 * the MFA API access token obtained via the authorization round-trip and —
 * once `associate` ran — the ids of the authenticator methods it supersedes.
 * Never leaves the cache; deleted on completion or expiry.
 */
export const MfaEnrollmentSessionSchema = z.object({
  mfaApiToken: z.string().min(1),
  supersededIds: z.array(z.string().min(1)).optional(),
});

export type MfaEnrollmentSession = z.infer<typeof MfaEnrollmentSessionSchema>;
