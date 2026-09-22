// SPDX-License-Identifier: FSL-1.1-MIT

import type { EntityManager } from 'typeorm';
import type { AddressBookDbItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.db.entity';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import type { UpsertAddressBookItemsDto } from '@/modules/spaces/routes/address-books/entities/upsert-address-book-items.dto.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';

export const IAddressBookItemsRepository = Symbol(
  'IAddressBookItemsRepository',
);

/**
 * Data access only: the caller (a route service) asserts the workspace
 * membership or admin role before reaching this repository.
 */
export interface IAddressBookItemsRepository {
  /**
   * Finds AddressBookItems by Space ID.
   * @param {number} spaceId - The ID of the Space.
   */
  findAllBySpaceId(spaceId: Space['id']): Promise<Array<AddressBookDbItem>>;

  /**
   * Upserts AddressBookItems.
   *
   * For each item, the address is compared against existing items in the Space.
   * If a match exists, it is updated. Otherwise, a new item is created.
   *
   * @param args.userId - The acting user, recorded as `lastUpdatedBy` and the
   *   audit actor.
   * @param args.spaceId - The ID of the Space.
   * @param args.addressBookItems - The items to upsert.
   * @param args.createdByOverride - If provided, new items are attributed to this
   *   user ID instead of the acting user. Used by the request-approval flow
   *   to attribute creation to the original requester.
   * @param args.entityManager - If provided, the upsert joins this (caller-owned)
   *   transaction instead of opening its own.
   */
  upsertMany(args: {
    userId: User['id'];
    spaceId: Space['id'];
    addressBookItems: UpsertAddressBookItemsDto['items'];
    createdByOverride?: number;
    entityManager?: EntityManager;
  }): Promise<Array<AddressBookDbItem>>;

  /**
   * Deletes an {@link AddressBookDbItem} by address.
   * @param args.userId - The acting user, recorded as the audit actor.
   * @param {number} args.spaceId - The ID of the Space.
   * @param {AddressBookDbItem['address']} args.address - The address of an AddressBookItem to delete.
   */
  deleteByAddress(args: {
    userId: User['id'];
    spaceId: Space['id'];
    address: AddressBookDbItem['address'];
  }): Promise<void>;
}
