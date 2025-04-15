import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Space } from '@/datasources/spaces/entities/space.entity.db';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { faker } from '@faker-js/faker/.';

export function spaceBuilder(): IBuilder<Space> {
  return new Builder<Space>()
    .with('id', faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }))
    .with('name', nameBuilder())
    .with('status', 'ACTIVE');
}
