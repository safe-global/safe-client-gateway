// SPDX-License-Identifier: FSL-1.1-MIT

import type { EntityManager } from 'typeorm';
import type { AddressBookItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.entity';
import type {
  AddressBookRequest,
  AddressBookRequestStatus,
} from '@/modules/spaces/domain/address-books/entities/address-book-request.entity';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';

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

  countPending(args: {
    spaceId: Space['id'];
    requestedById: User['id'];
  }): Promise<number>;

  create(args: {
    spaceId: Space['id'];
    requestedById: User['id'];
    item: AddressBookItem;
  }): Promise<AddressBookRequest>;

  transitionFromPending(args: {
    id: AddressBookRequest['id'];
    spaceId: Space['id'];
    toStatus: 'APPROVED' | 'REJECTED';
    reviewedBy: User['id'];
    entityManager?: EntityManager;
  }): Promise<boolean>;
}
