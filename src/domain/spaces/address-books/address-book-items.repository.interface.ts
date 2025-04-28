import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { AddressBookDbItem } from '@/domain/spaces/address-books/entities/address-book-item.db.entity';
import type { Space } from '@/domain/spaces/entities/space.entity';
import type { UpsertAddressBookItemsDto } from '@/routes/spaces/entities/upsert-address-book-items.dto.entity';

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
   * @param {AuthPayload} args.authPayload - The authentication payload.
   * @param {number} args.spaceId - The ID of the Space.
   * @param {UpsertAddressBookItemsDtoEntity['items']} args.addressBookItems - The AddressBookItems to upsert.
   *
   * For each AddressBookItem in {@link args.addressBookItems},
   * the address is compared against the existing AddressBookItems in the database.
   * If an AddressBookItem with the same address exists, it is updated.
   * Otherwise, a new AddressBookItem is created.
   *
   * @returns {Array<AddressBookDbItem>} Returns an array of updated address book items
   */
  upsertMany(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    addressBookItems: UpsertAddressBookItemsDto['items'];
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
