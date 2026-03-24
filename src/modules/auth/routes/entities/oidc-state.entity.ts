// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export const OidcStateSchema = z.object({
  csrf: z.hex().length(64),
  redirectUrl: z.string().min(1).max(2048).optional(),
});

export type OidcState = z.infer<typeof OidcStateSchema>;
