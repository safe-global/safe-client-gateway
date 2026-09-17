// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

/** What a plan grants for one feature. The only part cached; never usage. */
const FeatureGrantSchema = z.object({
  /** NULL = unlimited. Always the plan's quota, never inflated. */
  quota: z.number().int().nullable(),
  resetsAt: z.coerce.date().nullable(),
  /**
   * Which counter the quota is measured against. NULL for a stock-metered
   * feature, whose usage is a live count in another module's table. Cached
   * like `resetsAt`, so a Free window rolling over on its own anchor can lag
   * by the TTL.
   */
  counter: z
    .object({
      featureId: z.number().int(),
      periodStart: z.coerce.date(),
    })
    .nullable(),
});

export type FeatureGrant = z.infer<typeof FeatureGrantSchema>;

export const CachedGrantsSchema = z.record(z.string(), FeatureGrantSchema);
