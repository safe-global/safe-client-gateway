// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';

export type FeatureKey = string;

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
