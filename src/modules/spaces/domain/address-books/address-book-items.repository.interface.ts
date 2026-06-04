// SPDX-License-Identifier: FSL-1.1-MIT

import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import type { AddressBookDbItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.db.entity';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import type { UpsertAddressBookItemsDto } from '@/modules/spaces/routes/entities/upsert-address-book-items.dto.entity';

export const IAddressBookItemsRepository = Symbol(
  'IAddressBookItemsRepository',
);

export interface IAddressBookItemsRepository {
  /**
   * Finds AddressBookItems by Space ID.
   * @param {AuthPayload} args.authPayload - The authentication payload.
   * @param {number} args.spaceId - The ID of the Space.
   */
  findAllBySpaceId(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<Array<AddressBookDbItem>>;

  /**
   * Upserts AddressBookItems.
   *
   * For each item, the address is compared against existing items in the Space.
   * If a match exists, it is updated. Otherwise, a new item is created.
   *
   * @param args.authPayload - The authenticated user (must be an ADMIN of the Space).
   * @param args.spaceId - The ID of the Space.
   * @param args.addressBookItems - The items to upsert.
   * @param args.createdByOverride - If provided, new items are attributed to this
   *   user ID instead of the authenticated user. Used by the request-approval flow
   *   to attribute creation to the original requester.
   */
  upsertMany(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    addressBookItems: UpsertAddressBookItemsDto['items'];
    createdByOverride?: number;
  }): Promise<Array<AddressBookDbItem>>;

  /**
   * Deletes an {@link AddressBookDbItem} by address.
   * @param {AuthPayload} args.authPayload - The authentication payload.
   * @param {number} args.spaceId - The ID of the Space.
   * @param {AddressBookDbItem['address']} args.address - The address of an AddressBookItem to delete.
   */
  deleteByAddress(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    address: AddressBookDbItem['address'];
  }): Promise<void>;
}
