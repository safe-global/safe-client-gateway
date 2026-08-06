// SPDX-License-Identifier: FSL-1.1-MIT
import type { EntityManager } from 'typeorm';
import type { Feature } from '@/modules/entitlements/datasources/entities/feature.entity.db';
import type { FeatureKey } from '@/modules/entitlements/domain/entities/feature.entity';

export const IFeaturesRepository = Symbol('IFeaturesRepository');

/** Queries over the `features` catalog table. */
export interface IFeaturesRepository {
  getFeatures(entityManager?: EntityManager): Promise<Array<Feature>>;

  getFeatureByKey(
    key: FeatureKey,
    entityManager?: EntityManager,
  ): Promise<Feature | null>;
}
