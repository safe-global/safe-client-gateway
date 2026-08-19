// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { SubscriptionStatusSchema } from '@/datasources/billing-api/entities/subscription.entity';

/**
 * One entry of a purchased feature package, mapped from the upstream
 * subscription's `FEATURE_*` metadata (see `mapFeaturePackage`).
 */
export type ParsedEntitlement = z.infer<typeof ParsedEntitlementSchema>;

export const ParsedEntitlementSchema = z.object({
  featureKey: z.string(),
  enabled: z.boolean(),
  quota: z.number().int().nullable(),
  value: z.string().nullable(),
});

/**
 * An upstream subscription mapped to its materialized shape, ready to be
 * upserted by `EntitlementsService.materialize`.
 */
export type MaterializedSubscription = z.infer<
  typeof MaterializedSubscriptionSchema
>;

export const MaterializedSubscriptionSchema = z.object({
  upstreamSubscriptionId: z.string(),
  status: SubscriptionStatusSchema,
  planId: z.string(),
  planName: z.string().nullable(),
  currentPeriodStart: z.date().nullable(),
  currentPeriodEnd: z.date().nullable(),
  entitlements: z.array(ParsedEntitlementSchema).nullable(),
});
