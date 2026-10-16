// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '#/__tests__/builder';
import { Builder } from '#/__tests__/builder';
import { DB_MAX_SAFE_INTEGER } from '#/domain/common/constants';
import {
  type AddressBookTag,
  TAG_COLORS,
} from '#/modules/spaces/domain/address-books/entities/address-book-tag.entity';

export function addressBookTagBuilder(): IBuilder<AddressBookTag> {
  return new Builder<AddressBookTag>()
    .with('id', faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }))
    .with('name', faker.word.noun())
    .with('color', faker.helpers.arrayElement(TAG_COLORS))
    .with('contactCount', faker.number.int({ max: 10 }));
}
