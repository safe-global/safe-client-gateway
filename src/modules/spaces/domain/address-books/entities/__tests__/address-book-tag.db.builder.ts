// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { IBuilder } from '#/__tests__/builder';
import { Builder } from '#/__tests__/builder';
import { DB_MAX_SAFE_INTEGER } from '#/domain/common/constants';
import type { AddressBookTag } from '#/modules/spaces/datasources/address-books/entities/address-book-tag.entity.db';
import { TAG_COLORS } from '#/modules/spaces/domain/address-books/entities/address-book-tag.entity';
import { spaceBuilder } from '#/modules/spaces/domain/entities/__tests__/space.entity.db.builder';

/**
 * A `space_address_book_tags` row as stored without a blind-index key: the
 * name is plaintext and `nameIndex` is `<spaceId>:<lowercased name>`. Override
 * `nameIndex` together with `space` or `name`.
 */
export function addressBookTagDbBuilder(): IBuilder<AddressBookTag> {
  const space = spaceBuilder().build();
  const name = faker.word.noun();
  return new Builder<AddressBookTag>()
    .with('id', faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }))
    .with('space', space)
    .with('name', name)
    .with('nameIndex', `${space.id}:${name.toLowerCase()}`)
    .with('color', faker.helpers.arrayElement(TAG_COLORS))
    .with('createdBy', faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }))
    .with('createdAt', new Date())
    .with('updatedAt', new Date());
}
