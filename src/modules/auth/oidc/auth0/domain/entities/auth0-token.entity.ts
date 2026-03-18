// SPDX-License-Identifier: FSL-1.1-MIT
import { JwtClaimsSchema } from '@/datasources/jwt/jwt-claims.entity';
import { z } from 'zod';

export const Auth0TokenSchema = JwtClaimsSchema.extend({
  sub: z.string().min(1),
});

export type Auth0Token = z.infer<typeof Auth0TokenSchema>;
