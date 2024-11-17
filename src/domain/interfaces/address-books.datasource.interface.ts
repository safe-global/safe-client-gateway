import type { AddressBook } from '@/domain/accounts/address-books/entities/address-book.entity';
import type { CreateAddressBookItemDto } from '@/domain/accounts/address-books/entities/create-address-book-item.dto.entity';
import type { Account } from '@/domain/accounts/entities/account.entity';

export const IAddressBooksDataSource = Symbol('IAddressBooksDataSource');

export interface IAddressBooksDataSource {
  createAddressBookItem(args: {
    account: Account;
    createAddressBookItemDto: CreateAddressBookItemDto;
  }): Promise<AddressBook>;
}
