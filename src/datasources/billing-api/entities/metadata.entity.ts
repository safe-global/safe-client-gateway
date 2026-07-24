// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export type StripeMetadata = z.infer<typeof StripeMetadataSchema>;

// Generic, like Stripe metadata itself: preserves arbitrary keys instead of a fixed subset.
export const StripeMetadataSchema = z.record(z.string(), z.string().nullable());
