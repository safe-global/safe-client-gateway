// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import type { SpaceSafe } from '@/modules/spaces/datasources/safes/entities/space-safes.entity.db';
import { spaceBuilder } from '@/modules/spaces/domain/entities/__tests__/space.entity.db.builder';

export function spaceSafeBuilder(): IBuilder<SpaceSafe> {
  return new Builder<SpaceSafe>()
    .with('id', faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }))
    .with('chainId', faker.string.numeric({ length: { min: 1, max: 6 } }))
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('addressIndex', null)
    .with('createdAt', faker.date.recent())
    .with('updatedAt', faker.date.recent())
    .with('space', spaceBuilder().build());
}
