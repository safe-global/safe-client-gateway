// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import type { SpaceSeatSelection } from '@/modules/entitlements/domain/entities/space-seat-selection.entity';

export function spaceSeatSelectionBuilder(): IBuilder<SpaceSeatSelection> {
  return new Builder<SpaceSeatSelection>()
    .with('id', faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }))
    .with('createdAt', faker.date.recent())
    .with('updatedAt', faker.date.recent());
}
