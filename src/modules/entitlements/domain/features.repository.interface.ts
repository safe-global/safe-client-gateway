// SPDX-License-Identifier: FSL-1.1-MIT
import type { Feature } from '@/modules/entitlements/datasources/entities/feature.entity.db';

export const IFeaturesRepository = Symbol('IFeaturesRepository');

/** Queries over the `features` catalog table. */
export interface IFeaturesRepository {
  getFeatures(): Promise<Array<Feature>>;
}
