import { AddressBooksDatasourceModule } from '@/modules/accounts/datasources/address-books/address-books.datasource.module';
import { AccountsRepositoryModule } from '@/modules/accounts/domain/accounts.repository.interface';
import { AddressBooksRepository } from '@/modules/accounts/domain/address-books/address-books.repository';
import type {
  AddressBook,
  AddressBookItem,
} from '@/modules/accounts/domain/address-books/entities/address-book.entity';
import { CreateAddressBookItemDto } from '@/modules/accounts/domain/address-books/entities/create-address-book-item.dto.entity';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Module } from '@nestjs/common';
import type { Address } from 'viem';

export const IAddressBooksRepository = Symbol.for('IAddressBooksRepository');

export interface IAddressBooksRepository {
  getAddressBook(args: {
    authPayload: AuthPayload;
    address: Address;
    chainId: string;
  }): Promise<AddressBook>;

  createAddressBookItem(args: {
    authPayload: AuthPayload;
    address: Address;
    chainId: string;
    createAddressBookItemDto: CreateAddressBookItemDto;
  }): Promise<AddressBookItem>;

  deleteAddressBook(args: {
    authPayload: AuthPayload;
    address: Address;
    chainId: string;
  }): Promise<void>;

  deleteAddressBookItem(args: {
    authPayload: AuthPayload;
    address: Address;
    chainId: string;
    addressBookItemId: number;
  }): Promise<void>;
}

@Module({
  imports: [AccountsRepositoryModule, AddressBooksDatasourceModule],
  providers: [
    {
      provide: IAddressBooksRepository,
      useClass: AddressBooksRepository,
    },
  ],
  exports: [IAddressBooksRepository],
})
export class AddressBooksRepositoryModule {}
