// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export const OidcConnectionValues = ['email', 'google-oauth2'] as const;
export const OidcConnectionSchema = z.enum(OidcConnectionValues);
export type OidcConnection = z.infer<typeof OidcConnectionSchema>;
