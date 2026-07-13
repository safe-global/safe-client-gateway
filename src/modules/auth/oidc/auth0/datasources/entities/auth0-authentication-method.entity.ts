// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

// https://auth0.com/docs/api/management/v2/users/get-authentication-methods
export const Auth0AuthenticationMethodSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string().optional(),
  created_at: z.string().optional(),
});

export const Auth0AuthenticationMethodsSchema = z.array(
  Auth0AuthenticationMethodSchema,
);

export type Auth0AuthenticationMethod = z.infer<
  typeof Auth0AuthenticationMethodSchema
>;

export const TOTP_AUTHENTICATION_METHOD_TYPE = 'totp';
