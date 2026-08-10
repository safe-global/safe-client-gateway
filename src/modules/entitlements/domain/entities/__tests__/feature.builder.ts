// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import type { Feature } from '@/modules/entitlements/domain/entities/feature.entity';
import { FeatureTypes } from '@/modules/entitlements/domain/entities/feature.entity';

export function featureBuilder(): IBuilder<Feature> {
  return new Builder<Feature>()
    .with('id', faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }))
    .with('key', faker.lorem.slug())
    .with('type', faker.helpers.arrayElement(FeatureTypes))
    .with('description', faker.lorem.sentence())
    .with('freeEnabled', faker.datatype.boolean())
    .with('freeQuota', faker.number.int({ min: 1, max: 1_000 }))
    .with('freeValue', null)
    .with('freePeriod', null)
    .with('createdAt', faker.date.recent())
    .with('updatedAt', faker.date.recent());
}
