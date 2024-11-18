import { IConfigurationService } from '@/config/configuration.service.interface';
import { AddressBookDbMapper } from '@/datasources/accounts/address-books/entities/address-book.db.mapper';
import { AddressBook as DbAddressBook } from '@/datasources/accounts/address-books/entities/address-book.entity';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { CachedQueryResolver } from '@/datasources/db/v1/cached-query-resolver';
import { ICachedQueryResolver } from '@/datasources/db/v1/cached-query-resolver.interface';
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
  private readonly defaultExpirationTimeInSeconds: number;

  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject('DB_INSTANCE') private readonly sql: postgres.Sql,
    @Inject(ICachedQueryResolver)
    private readonly cachedQueryResolver: CachedQueryResolver,
    @Inject(IEncryptionApiManager)
    private readonly encryptionApiManager: IEncryptionApiManager,
    // @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly addressBookMapper: AddressBookDbMapper,
  ) {
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
  }

  async createAddressBookItem(args: {
    account: Account;
    createAddressBookItemDto: CreateAddressBookItemDto;
  }): Promise<AddressBookItem> {
    const addressBook = await this.getOrCreateAddressBook(args.account);
    const newItem = {
      id: addressBook.data.length + 1,
      ...args.createAddressBookItemDto,
    };
    addressBook.data.push(newItem);
    await this.updateAddressBook(addressBook);
    return newItem;
  }

  async getOrCreateAddressBook(account: Account): Promise<AddressBook> {
    const cacheDir = CacheRouter.getAddressBookCacheDir(account.id);
    const [dbAddressBook] = await this.cachedQueryResolver.get<DbAddressBook[]>(
      {
        cacheDir,
        query: this.sql<
          DbAddressBook[]
        >`SELECT * FROM address_books WHERE account_id = ${account.id}`,
        ttl: this.defaultExpirationTimeInSeconds,
      },
    );
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

  private async updateAddressBook(addressBook: AddressBook): Promise<void> {
    const encryptionApi = await this.encryptionApiManager.getApi();
    const encryptedBlob = await encryptionApi.encryptBlob(addressBook.data);
    await this.sql`
      UPDATE address_books
      SET data = ${encryptedBlob.encryptedData},
          key = ${encryptedBlob.encryptedDataKey},
          iv = ${encryptedBlob.iv}
      WHERE id = ${addressBook.id}
    `;
    await this.cacheService.deleteByKey(
      CacheRouter.getAddressBookCacheKey(addressBook.accountId),
    );
  }
}
