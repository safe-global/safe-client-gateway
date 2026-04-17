// SPDX-License-Identifier: FSL-1.1-MIT
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';
import type { UserAddressBookItem } from '@/modules/spaces/domain/address-books/entities/user-address-book-item.entity';
import type { AddressBookItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.entity';
import type { Address } from 'viem';

export const IUserAddressBookItemsRepository = Symbol(
  'IUserAddressBookItemsRepository',
);

export interface IUserAddressBookItemsRepository {
  findBySpaceAndCreator(args: {
    spaceId: Space['id'];
    creatorId: User['id'];
  }): Promise<Array<UserAddressBookItem>>;

  findOneBySpaceCreatorAndAddress(args: {
    spaceId: Space['id'];
    creatorId: User['id'];
    address: UserAddressBookItem['address'];
  }): Promise<UserAddressBookItem | null>;

  upsertMany(args: {
    spaceId: Space['id'];
    creatorId: User['id'];
    signerAddress: Address;
    items: Array<AddressBookItem>;
  }): Promise<Array<UserAddressBookItem>>;

  deleteByAddress(args: {
    spaceId: Space['id'];
    creatorId: User['id'];
    address: UserAddressBookItem['address'];
  }): Promise<void>;
}
