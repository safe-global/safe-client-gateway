import {
  AddressBook,
  AddressBookItem,
} from '@/modules/accounts/routes/address-books/entities/address-book.entity';
import { AddressBook as DomainAddressBook } from '@/modules/accounts/domain/address-books/entities/address-book.entity';
import { AddressBookItem as DomainAddressBookItem } from '@/modules/accounts/domain/address-books/entities/address-book.entity';
import { Inject, Injectable } from '@nestjs/common';
import { IAddressBooksRepository } from '@/modules/accounts/domain/address-books/address-books.repository.interface';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { CreateAddressBookItemDto } from '@/modules/accounts/domain/address-books/entities/create-address-book-item.dto.entity';
import type { Address } from 'viem';

@Injectable()
export class AddressBooksService {
  constructor(
    @Inject(IAddressBooksRepository)
    private readonly repository: IAddressBooksRepository,
  ) {}

  async getAddressBook(args: {
    authPayload: AuthPayload;
    address: Address;
    chainId: string;
  }): Promise<AddressBook> {
    const domainAddressBook = await this.repository.getAddressBook(args);
    return this.mapAddressBook(domainAddressBook);
  }

  async createAddressBookItem(args: {
    authPayload: AuthPayload;
    address: Address;
    chainId: string;
    createAddressBookItemDto: CreateAddressBookItemDto;
  }): Promise<AddressBookItem> {
    const domainAddressBookItem =
      await this.repository.createAddressBookItem(args);
    return this.mapAddressBookItem(domainAddressBookItem);
  }

  async deleteAddressBook(args: {
    authPayload: AuthPayload;
    address: Address;
    chainId: string;
  }): Promise<void> {
    await this.repository.deleteAddressBook(args);
  }

  async deleteAddressBookItem(args: {
    authPayload: AuthPayload;
    address: Address;
    chainId: string;
    addressBookItemId: number;
  }): Promise<void> {
    await this.repository.deleteAddressBookItem(args);
  }

  private mapAddressBook(domainAddressBook: DomainAddressBook): AddressBook {
    return {
      id: domainAddressBook.id.toString(),
      accountId: domainAddressBook.accountId.toString(),
      chainId: domainAddressBook.chainId,
      data: domainAddressBook.data.map((item) => ({
        id: item.id.toString(),
        name: item.name,
        address: item.address,
      })),
    };
  }

  private mapAddressBookItem(
    domainAddressBookItem: DomainAddressBookItem,
  ): AddressBookItem {
    return {
      id: domainAddressBookItem.id.toString(),
      name: domainAddressBookItem.name,
      address: domainAddressBookItem.address,
    };
  }
}
