// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import type { SpaceFeatureUsage } from '@/modules/entitlements/domain/entities/space-feature-usage.entity';

export function spaceFeatureUsageBuilder(): IBuilder<SpaceFeatureUsage> {
  return new Builder<SpaceFeatureUsage>()
    .with('id', faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }))
    .with('periodStart', faker.date.recent())
    .with('used', faker.number.int({ min: 0, max: 1_000 }))
    .with('createdAt', faker.date.recent())
    .with('updatedAt', faker.date.recent());
}
