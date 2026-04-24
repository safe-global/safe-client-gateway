// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export const Auth0JwkSchema = z.object({
  kid: z.string().min(1),
  kty: z.literal('RSA'),
  use: z.string().optional(),
  alg: z.string().optional(),
  n: z.string().min(1).optional(),
  e: z.string().min(1).optional(),
  x5c: z.array(z.string().min(1)).optional(),
});

export const Auth0JwksSchema = z.object({
  keys: z.array(Auth0JwkSchema),
});

export type Auth0Jwk = z.infer<typeof Auth0JwkSchema>;
export type Auth0Jwks = z.infer<typeof Auth0JwksSchema>;
