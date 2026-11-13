// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { IBuilder } from '#/__tests__/builder';
import { Builder } from '#/__tests__/builder';
import { DB_MAX_SAFE_INTEGER } from '#/domain/common/constants';
import type { AddressBookItemTag } from '#/modules/spaces/datasources/address-books/entities/address-book-item-tag.entity.db';

/** A `space_address_book_item_tags` row: one contact carrying one tag. */
export function addressBookItemTagDbBuilder(): IBuilder<AddressBookItemTag> {
  return new Builder<AddressBookItemTag>()
    .with('id', faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }))
    .with('itemId', faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }))
    .with('tagId', faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }))
    .with('createdAt', new Date())
    .with('updatedAt', new Date());
}
