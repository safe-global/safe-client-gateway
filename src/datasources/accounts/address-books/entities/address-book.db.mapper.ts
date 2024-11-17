import { AddressBook as DbAddressBook } from '@/datasources/accounts/address-books/entities/address-book.entity';
import { convertToDate } from '@/datasources/common/utils';
import { AddressBook } from '@/domain/accounts/address-books/entities/address-book.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AddressBookDbMapper {
  map(addressBook: DbAddressBook): AddressBook {
    return {
      id: addressBook.id,
      data: addressBook.data,
      accountId: addressBook.account_id,
      created_at: convertToDate(addressBook.created_at),
      updated_at: convertToDate(addressBook.updated_at),
    };
  }
}
