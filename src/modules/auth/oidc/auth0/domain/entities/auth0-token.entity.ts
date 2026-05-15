// SPDX-License-Identifier: FSL-1.1-MIT

import { z } from 'zod';
import { JwtClaimsSchema } from '@/datasources/jwt/jwt-claims.entity';
import { EmailAddressSchema } from '@/validation/entities/schemas/email-address.schema';

// Auth0 ID token claims:
// https://auth0.com/docs/tokens/references/id-token-structure
export const Auth0TokenSchema = JwtClaimsSchema.extend({
  sub: z.string().min(1),
  email: EmailAddressSchema.optional(),
  email_verified: z.boolean().optional(),
}).superRefine((token, ctx) => {
  if (token.email_verified === true && token.email === undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'email is required when email_verified is true',
      path: ['email'],
    });
  }
});

export type Auth0Token = z.infer<typeof Auth0TokenSchema>;
