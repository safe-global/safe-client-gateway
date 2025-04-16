import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { AddressBookItem } from '@/domain/spaces/address-books/entities/address-book-item.entity';
import type { Space } from '@/domain/spaces/entities/space.entity';

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
  }): Promise<Array<AddressBookItem>>;

  /**
   * Upserts AddressBookItems.
   *
   * @param {AuthPayload} args.authPayload - The authentication payload.
   * @param {number} args.spaceId - The ID of the Space.
   * @param {Array<AddressBookItem>} args.addressBookItems - The AddressBookItems to upsert.
   *
   * For each AddressBookItem in {@link args.addressBookItems},
   * the address is compared against the existing AddressBookItems in the database.
   * If an AddressBookItem with the same address exists, it is updated.
   * Otherwise, a new AddressBookItem is created.
   *
   * @returns {Array<AddressBookItem>} Returns an array of updated address book items
   */
  upsertMany(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    addressBookItems: Array<AddressBookItem>;
  }): Promise<Array<AddressBookItem>>;

  /**
   * Deletes an array of AddressBookItems by their IDs.
   * @param {AuthPayload} args.authPayload - The authentication payload.
   * @param {number} args.spaceId - The ID of the Space.
   * @param {Array<AddressBookItem>} args.addressBookItemIds - The IDs of the AddressBookItems to delete.
   */
  deleteMany(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    addressBookItemIds: Array<string>;
  }): Promise<void>;
}
