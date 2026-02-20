// SPDX-License-Identifier: FSL-1.1-MIT
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { faker } from '@faker-js/faker/.';
import type { Oauth } from '@/modules/auth/datasources/entities/oauth.entity.db';
import { OauthType } from '@/modules/auth/domain/entities/oauth.entity';
import { userBuilder } from '@/modules/users/datasources/entities/__tests__/users.entity.db.builder';
import { getStringEnumKeys } from '@/domain/common/utils/enum';

export function oauthBuilder(): IBuilder<Oauth> {
  return new Builder<Oauth>()
    .with('id', faker.number.int())
    .with('type', faker.helpers.arrayElement(getStringEnumKeys(OauthType)))
    .with('extUserId', faker.string.alphanumeric(21))
    .with('user', userBuilder().build())
    .with('createdAt', new Date())
    .with('updatedAt', new Date());
}
