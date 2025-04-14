import type { AddressBookItem as DbAddressBookItem } from '@/datasources/spaces/entities/address-book-item.entity.db';
import type { AddressBookItem } from '@/domain/spaces/address-books/entities/address-book-item.entity';

export const IAddressBookItemsRepository = Symbol(
  'IAddressBookItemsRepository',
);

export interface IAddressBookItemsRepository {
  /**
   * Finds AddressBookItems by Space ID.
   * @param spaceId - The ID of the Space.
   */
  findABySpaceId(spaceId: string): Promise<Array<DbAddressBookItem>>;

  /**
   * Upserts AddressBookItems.
   * @param args.spaceId - The ID of the Space.
   * @param args.addressBookItems - The AddressBookItems to upsert.
   *
   * For each AddressBookItem in {@link args.addressBookItems},
   * the address is compared against the existing AddressBookItems in the database.
   * If an AddressBookItem with the same address exists, it is updated.
   * Otherwise, a new AddressBookItem is created.
   */
  upsertMany(args: {
    spaceId: string;
    addressBookItems: Array<AddressBookItem>;
  }): Promise<Array<DbAddressBookItem>>;

  /**
   * Deletes an array of AddressBookItems by their IDs.
   * @param args.spaceId - The ID of the Space.
   * @param args.addressBookItemIds - The IDs of the AddressBookItems to delete.
   */
  deleteMany(args: {
    spaceId: string;
    addressBookItemIds: Array<string>;
  }): Promise<void>;
}
