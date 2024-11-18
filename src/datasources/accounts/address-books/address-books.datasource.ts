import { AddressBookDbMapper } from '@/datasources/accounts/address-books/entities/address-book.db.mapper';
import { AddressBook as DbAddressBook } from '@/datasources/accounts/address-books/entities/address-book.entity';
import {
  AddressBook,
  AddressBookItem,
} from '@/domain/accounts/address-books/entities/address-book.entity';
import { CreateAddressBookItemDto } from '@/domain/accounts/address-books/entities/create-address-book-item.dto.entity';
import { Account } from '@/domain/accounts/entities/account.entity';
import { IEncryptionApiManager } from '@/domain/interfaces/encryption-api.manager.interface';
import { Inject, Injectable } from '@nestjs/common';
import postgres from 'postgres';

@Injectable()
export class AddressBooksDatasource {
  constructor(
    @Inject('DB_INSTANCE') private readonly sql: postgres.Sql,
    @Inject(IEncryptionApiManager)
    private readonly encryptionApiManager: IEncryptionApiManager,
    private readonly addressBookMapper: AddressBookDbMapper,
  ) {}

  async createAddressBookItem(args: {
    account: Account;
    createAddressBookItemDto: CreateAddressBookItemDto;
  }): Promise<AddressBookItem> {
    const addressBook = await this.getOrCreateAddressBook(args.account);
    const newItem = {
      id: addressBook.data.length + 1,
      address: args.createAddressBookItemDto.address,
      name: args.createAddressBookItemDto.name,
    };
    addressBook.data.push(newItem);
    await this.updateAddressBook(addressBook);
    return newItem;
  }

  async getOrCreateAddressBook(account: Account): Promise<AddressBook> {
    const [dbAddressBook] = await this.sql<
      DbAddressBook[]
    >`SELECT * FROM address_books WHERE account_id = ${account.id}`;
    return dbAddressBook
      ? this.addressBookMapper.map(dbAddressBook)
      : this.addressBookMapper.map(await this.createAddressBook({ account }));
  }

  private async createAddressBook(args: {
    account: Account;
  }): Promise<DbAddressBook> {
    const encryptionApi = await this.encryptionApiManager.getApi();
    const encryptedBlob = await encryptionApi.encryptBlob([]);
    const [dbAddressBook] = await this.sql<DbAddressBook[]>`
      INSERT INTO address_books (data, key, iv, account_id)
      VALUES (
        ${encryptedBlob.encryptedData},
        ${encryptedBlob.encryptedDataKey},
        ${encryptedBlob.iv},
        ${args.account.id}
      ) RETURNING *;
    `;
    return dbAddressBook;
  }

  private async updateAddressBook(
    addressBook: AddressBook,
  ): Promise<DbAddressBook> {
    const encryptionApi = await this.encryptionApiManager.getApi();
    const encryptedBlob = await encryptionApi.encryptBlob(addressBook.data);
    const [dbAddressBook] = await this.sql<DbAddressBook[]>`
      UPDATE address_books
      SET data = ${encryptedBlob.encryptedData},
          key = ${encryptedBlob.encryptedDataKey},
          iv = ${encryptedBlob.iv}
      WHERE id = ${addressBook.id}
     RETURNING *;
    `;
    return dbAddressBook;
  }
}
