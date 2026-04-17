// SPDX-License-Identifier: FSL-1.1-MIT
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';
import type {
  AddressBookRequest,
  AddressBookRequestStatus,
} from '@/modules/spaces/domain/address-books/entities/address-book-request.entity';
import type { AddressBookItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.entity';
import type { Address } from 'viem';

export const IAddressBookRequestsRepository = Symbol(
  'IAddressBookRequestsRepository',
);

export interface IAddressBookRequestsRepository {
  findBySpaceId(args: {
    spaceId: Space['id'];
    status?: keyof typeof AddressBookRequestStatus;
  }): Promise<Array<AddressBookRequest>>;

  findBySpaceAndRequester(args: {
    spaceId: Space['id'];
    requestedById: User['id'];
    status?: keyof typeof AddressBookRequestStatus;
  }): Promise<Array<AddressBookRequest>>;

  findOneOrFail(args: {
    id: AddressBookRequest['id'];
    spaceId: Space['id'];
  }): Promise<AddressBookRequest>;

  create(args: {
    spaceId: Space['id'];
    requestedById: User['id'];
    requestedByWallet: Address;
    item: AddressBookItem;
  }): Promise<AddressBookRequest>;

  updateStatus(args: {
    id: AddressBookRequest['id'];
    status: keyof typeof AddressBookRequestStatus;
    reviewedBy: Address;
  }): Promise<void>;
}
