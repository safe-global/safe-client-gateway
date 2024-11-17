import { IConfigurationService } from '@/config/configuration.service.interface';
import { AddressBookDbMapper } from '@/datasources/accounts/address-books/entities/address-book.db.mapper';
import { AddressBook as DbAddressBook } from '@/datasources/accounts/address-books/entities/address-book.entity';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { CachedQueryResolver } from '@/datasources/db/v1/cached-query-resolver';
import { ICachedQueryResolver } from '@/datasources/db/v1/cached-query-resolver.interface';
import { AddressBook } from '@/domain/accounts/address-books/entities/address-book.entity';
import { CreateAddressBookItemDto } from '@/domain/accounts/address-books/entities/create-address-book-item.dto.entity';
import { Account } from '@/domain/accounts/entities/account.entity';
import { IEncryptionApiManager } from '@/domain/interfaces/encryption-api.manager.interface';
import { Inject, Injectable } from '@nestjs/common';
import postgres from 'postgres';

@Injectable()
export class AddressBooksDatasource {
  private readonly defaultExpirationTimeInSeconds: number;

  constructor(
    // @Inject(CacheService) private readonly cacheService: ICacheService,
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
  }): Promise<AddressBook> {
    // TODO: return AddressBookItem
    const cacheDir = CacheRouter.getAddressBookCacheDir(args.account.id);
    const [dbAddressBook] = await this.cachedQueryResolver.get<DbAddressBook[]>(
      {
        cacheDir,
        query: this.sql<DbAddressBook[]>`
      SELECT * FROM address_books WHERE account_id = ${args.account.id}
    `,
        ttl: this.defaultExpirationTimeInSeconds,
      },
    );
    if (!dbAddressBook) {
      return this.createAddressBook({ account: args.account }); // TODO: return AddressBookItem
    }
    return this.addressBookMapper.map(dbAddressBook);
  }

  private async createAddressBook(args: {
    account: Account;
  }): Promise<AddressBook> {
    const encryptionApi = await this.encryptionApiManager.getApi();
    const encryptedBlob = await encryptionApi.encryptBlob([]);
    const [dbAddressBook] = await this.sql<DbAddressBook[]>`
      INSERT INTO address_books (data, key, iv, account_id)
      VALUES (${encryptedBlob.encryptedData}, ${encryptedBlob.encryptedDataKey}, ${encryptedBlob.iv}, ${args.account.id})
      RETURNING *;
    `;
    return this.addressBookMapper.map(dbAddressBook);
  }
}
