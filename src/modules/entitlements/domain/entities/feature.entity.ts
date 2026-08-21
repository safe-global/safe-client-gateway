// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';

/**
 * The catalog keys this API publishes, as an OpenAPI enum. The `features` table
 * is data and its `key` column a plain string, so the response is narrowed to
 * this list and a seeded-but-unpublished key never ships.
 */
export const FEATURE_KEYS = ['safe_seats'] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export function isFeatureKey(key: string): key is FeatureKey {
  return (FEATURE_KEYS as ReadonlyArray<string>).includes(key);
}

export enum FeatureType {
  Binary = 'binary',
  Metered = 'metered',
  Value = 'value',
}

export const FeatureTypeSchema = z.enum(FeatureType);

export type Feature = z.infer<typeof FeatureSchema>;

export const FeatureSchema = RowSchema.extend({
  key: z.string(),
  type: FeatureTypeSchema,
  description: z.string(),
  freeEnabled: z.boolean(),
  freeQuota: z.number().int().nullable(),
  freeValue: z.string().nullable(),
  freePeriod: z.number().int().nullable(),
});
