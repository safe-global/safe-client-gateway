// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export const Auth0TokenResponseSchema = z.object({
  id_token: z.string().min(1),
});

export type Auth0TokenResponse = z.infer<typeof Auth0TokenResponseSchema>;
