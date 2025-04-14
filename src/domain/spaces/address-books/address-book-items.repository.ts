import { AddressBookItem } from '@/datasources/spaces/entities/address-book-item.entity.db';
import { IAddressBookItemsRepository } from '@/domain/spaces/address-books/address-book-items.repository.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AddressBookItemsRepository implements IAddressBookItemsRepository {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  findABySpaceId(spaceId: string): Promise<Array<AddressBookItem>> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  upsertMany(args: {
    spaceId: string;
    addressBookItems: Array<AddressBookItem>;
  }): Promise<Array<AddressBookItem>> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  deleteMany(args: {
    spaceId: string;
    addressBookItemIds: Array<string>;
  }): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
