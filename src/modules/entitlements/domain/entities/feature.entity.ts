// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';

/**
 * Single source of truth for the gateable feature catalog.
 *
 * The list (and each feature's type) is mirrored by:
 * - the `features` table seed migration, and
 * - the OpenAPI `FeatureKey` enum exposed to client codegen.
 *
 * An integration test asserts the seeded catalog matches these definitions,
 * so DB, contract and generated client types cannot drift.
 */
export const FeatureKeys = [
  'security_hub',
  'safe_seats',
  'members',
  'copilot_scans',
  'sponsored_transactions',
  'swap_fee_tier',
  'shared_address_book',
  'pay_from_safe',
  'sso',
] as const;

export type FeatureKey = (typeof FeatureKeys)[number];

export const FeatureKeySchema = z.enum(FeatureKeys);

export const FeatureTypes = ['binary', 'metered', 'value'] as const;

export type FeatureType = (typeof FeatureTypes)[number];

export const FeatureTypeSchema = z.enum(FeatureTypes);

/**
 * The type of each feature is a fact about the feature itself (not about any
 * subscription) and is needed statically by the webhook metadata parser, so
 * it lives here alongside the key list.
 */
export const FEATURE_DEFINITIONS: Record<FeatureKey, FeatureType> = {
  security_hub: 'binary',
  safe_seats: 'metered',
  members: 'metered',
  copilot_scans: 'binary',
  sponsored_transactions: 'metered',
  swap_fee_tier: 'value',
  shared_address_book: 'binary',
  pay_from_safe: 'binary',
  sso: 'binary',
};

export type Feature = z.infer<typeof FeatureSchema>;

export const FeatureSchema = RowSchema.extend({
  key: FeatureKeySchema,
  type: FeatureTypeSchema,
  description: z.string(),
  freeEnabled: z.boolean(),
  freeQuota: z.number().int().nullable(),
  freeValue: z.string().nullable(),
  freePeriod: z.number().int().nullable(),
});
