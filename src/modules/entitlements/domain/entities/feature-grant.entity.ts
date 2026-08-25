// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

/** What a plan grants for one feature. The only part cached; never usage. */
const FeatureGrantSchema = z.object({
  /** NULL = unlimited. Always the plan's quota, never inflated. */
  quota: z.number().int().nullable(),
  resetsAt: z.coerce.date().nullable(),
});

export type FeatureGrant = z.infer<typeof FeatureGrantSchema>;

export const CachedGrantsSchema = z.record(z.string(), FeatureGrantSchema);
