import type {
  AddressBook,
  AddressBookItem,
} from '@/modules/accounts/domain/address-books/entities/address-book.entity';
import type { CreateAddressBookItemDto } from '@/modules/accounts/domain/address-books/entities/create-address-book-item.dto.entity';
import type { UpdateAddressBookItemDto } from '@/modules/accounts/domain/address-books/entities/update-address-book.item.dto.entity';
import type { Account } from '@/modules/accounts/domain/entities/account.entity';

export const IAddressBooksDatasource = Symbol('IAddressBooksDatasource');

export interface IAddressBooksDatasource {
  createAddressBookItem(args: {
    account: Account;
    chainId: string;
    createAddressBookItemDto: CreateAddressBookItemDto;
  }): Promise<AddressBookItem>;

  getAddressBook(args: {
    account: Account;
    chainId: string;
  }): Promise<AddressBook>;

  updateAddressBookItem(args: {
    addressBook: AddressBook;
    updateAddressBookItem: UpdateAddressBookItemDto;
  }): Promise<AddressBookItem>;

  deleteAddressBook(addressBook: AddressBook): Promise<void>;

  deleteAddressBookItem(args: {
    addressBook: AddressBook;
    id: number;
  }): Promise<void>;
}
