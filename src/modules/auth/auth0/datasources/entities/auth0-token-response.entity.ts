// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export const Auth0TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  id_token: z.string().min(1),
  token_type: z.literal('Bearer'),
  expires_in: z.number().int().positive().optional(),
  scope: z.string().optional(),
});

export type Auth0TokenResponse = z.infer<typeof Auth0TokenResponseSchema>;
