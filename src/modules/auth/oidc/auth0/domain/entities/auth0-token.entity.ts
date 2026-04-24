// SPDX-License-Identifier: FSL-1.1-MIT
import { JwtClaimsSchema } from '@/datasources/jwt/jwt-claims.entity';
import { z } from 'zod';

export const Auth0TokenSchema = JwtClaimsSchema.extend({
  sub: z.string().min(1),
  email: z.email().optional(),
  email_verified: z.boolean().optional(),
});

export const Auth0TokenHeaderSchema = z.object({
  kid: z.string().min(1),
  alg: z.string().min(1),
});

export type Auth0Token = z.infer<typeof Auth0TokenSchema>;
export type Auth0TokenHeader = z.infer<typeof Auth0TokenHeaderSchema>;
