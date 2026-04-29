// SPDX-License-Identifier: FSL-1.1-MIT
import { JwtClaimsSchema } from '@/datasources/jwt/jwt-claims.entity';
import { z } from 'zod';

// Auth0 ID token claims:
// https://auth0.com/docs/tokens/references/id-token-structure
export const Auth0TokenSchema = JwtClaimsSchema.extend({
  sub: z.string().min(1),
  email: z.email().optional(),
  email_verified: z.boolean().optional(),
});

export type Auth0Token = z.infer<typeof Auth0TokenSchema>;
