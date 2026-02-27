// SPDX-License-Identifier: FSL-1.1-MIT
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { faker } from '@faker-js/faker/.';
import type { User } from '@/modules/users/datasources/entities/users.entity.db';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { UserStatus } from '@/modules/users/domain/entities/user.entity';

export function userBuilder(): IBuilder<User> {
  return new Builder<User>()
    .with('id', faker.number.int())
    .with('status', faker.helpers.arrayElement(getStringEnumKeys(UserStatus)))
    .with('extUserId', null)
    .with('wallets', [])
    .with('members', [])
    .with('createdAt', new Date())
    .with('updatedAt', new Date());
}
