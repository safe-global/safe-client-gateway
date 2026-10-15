// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

// Retiring a feature needs a migration that strips it from stored rows.
export const ExperimentalFeatures = ['RECIPIENT_ALLOWLIST'] as const;

export const ExperimentalFeatureSchema = z.enum(ExperimentalFeatures);

export type ExperimentalFeature = z.infer<typeof ExperimentalFeatureSchema>;

// No .default(): Zod 4 applies it even under .optional(), so an omitted
// PATCH field would wipe the stored set.
export const ExperimentalFeaturesSchema = z
  .array(ExperimentalFeatureSchema)
  .max(ExperimentalFeatures.length)
  .transform((features): Array<ExperimentalFeature> => [...new Set(features)]);
