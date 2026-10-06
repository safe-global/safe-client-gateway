// SPDX-License-Identifier: FSL-1.1-MIT

import { z } from 'zod';
import { JwtClaimsSchema } from '@/datasources/jwt/jwt-claims.entity';

/**
 * Custom claim a post-login Action adds to access tokens: epoch seconds of the
 * most recent second-factor challenge, taken from Auth0's own record of it.
 */
export const AUTH0_MFA_VERIFIED_AT_CLAIM =
  'https://safe.global/mfa_verified_at';

// Auth0 access token claims:
// https://auth0.com/docs/secure/tokens/access-tokens/access-token-profiles
export const Auth0AccessTokenSchema = JwtClaimsSchema.extend({
  sub: z.string().min(1),
  // The client the token was issued to, e.g. one Claude connector.
  azp: z.string().min(1).optional(),
  [AUTH0_MFA_VERIFIED_AT_CLAIM]: z.number().int().nonnegative().optional(),
});

export type Auth0AccessToken = z.infer<typeof Auth0AccessTokenSchema>;
