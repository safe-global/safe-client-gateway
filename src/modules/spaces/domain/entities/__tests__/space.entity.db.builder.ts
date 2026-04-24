// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker/.';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import type { Space } from '@/modules/spaces/datasources/entities/space.entity.db';

export function spaceBuilder(): IBuilder<Space> {
  return new Builder<Space>()
    .with('id', faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }))
    .with('name', nameBuilder())
    .with('status', 'ACTIVE');
}
