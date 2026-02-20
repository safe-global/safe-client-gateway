// SPDX-License-Identifier: FSL-1.1-MIT
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { faker } from '@faker-js/faker/.';
import type { Auth } from '@/modules/auth/datasources/entities/auth.entity.db';
import { AuthType } from '@/modules/auth/domain/entities/auth.entity';
import { userBuilder } from '@/modules/users/datasources/entities/__tests__/users.entity.db.builder';
import { getStringEnumKeys } from '@/domain/common/utils/enum';

export function authBuilder(): IBuilder<Auth> {
  return new Builder<Auth>()
    .with('id', faker.number.int())
    .with('type', faker.helpers.arrayElement(getStringEnumKeys(AuthType)))
    .with(
      'extUserId',
      faker.string.alphanumeric({ length: { min: 1, max: 255 } }),
    )
    .with('user', userBuilder().build())
    .with('createdAt', new Date())
    .with('updatedAt', new Date());
}
