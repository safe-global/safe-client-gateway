// SPDX-License-Identifier: FSL-1.1-MIT
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { faker } from '@faker-js/faker/.';
import type { UUID } from 'crypto';

export function spaceBuilder(): IBuilder<Space> {
  return new Builder<Space>()
    .with('id', faker.string.uuid() as UUID)
    .with('name', nameBuilder())
    .with('status', 'ACTIVE');
}
