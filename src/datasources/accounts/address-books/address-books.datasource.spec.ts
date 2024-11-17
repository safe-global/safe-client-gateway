import { TestDbFactory } from '@/__tests__/db.factory';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { AddressBooksDatasource } from '@/datasources/accounts/address-books/address-books.datasource';
import { AddressBookDbMapper } from '@/datasources/accounts/address-books/entities/address-book.db.mapper';
import type { EncryptionApiManager } from '@/datasources/accounts/encryption/encryption-api.manager';
import { LocalEncryptionApiService } from '@/datasources/accounts/encryption/local-encryption-api.service';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CachedQueryResolver } from '@/datasources/db/v1/cached-query-resolver';
import { PostgresDatabaseMigrator } from '@/datasources/db/v1/postgres-database.migrator';
import { createAccountDtoBuilder } from '@/domain/accounts/entities/__tests__/create-account.dto.builder';
import type { Account } from '@/domain/accounts/entities/account.entity';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker/.';
import type postgres from 'postgres';
import { getAddress } from 'viem';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

const mockEncryptionApiManager = jest.mocked({
  getApi: jest.fn(),
} as jest.MockedObjectDeep<EncryptionApiManager>);

describe('AddressBooksDataSource', () => {
  let fakeCacheService: FakeCacheService;
  let sql: postgres.Sql;
  let migrator: PostgresDatabaseMigrator;
  let target: AddressBooksDatasource;
  const testDbFactory = new TestDbFactory();

  beforeAll(async () => {
    fakeCacheService = new FakeCacheService();
    sql = await testDbFactory.createTestDatabase(faker.string.uuid());
    migrator = new PostgresDatabaseMigrator(sql);
    await migrator.migrate();
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'expirationTimeInSeconds.default') return faker.number.int();
      if (key === 'application.isProduction') return false;
      if (key === 'accounts.encryption.local.algorithm') return 'aes-256-cbc';
      if (key === 'accounts.encryption.local.key') return 'a'.repeat(64);
      if (key === 'accounts.encryption.local.iv') return 'b'.repeat(32);
    });
    mockEncryptionApiManager.getApi.mockResolvedValue(
      new LocalEncryptionApiService(mockConfigurationService),
    );

    target = new AddressBooksDatasource(
      sql,
      new CachedQueryResolver(mockLoggingService, fakeCacheService),
      mockEncryptionApiManager,
      mockConfigurationService,
      new AddressBookDbMapper(),
    );
  });

  beforeEach(async () => {
    await sql`TRUNCATE TABLE accounts, account_data_settings, address_books CASCADE`;
    fakeCacheService.clear();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testDbFactory.destroyTestDatabase(sql);
  });

  describe('createAddressBookItem', () => {
    it('should create a new address book item', async () => {
      const createAccountDto = createAccountDtoBuilder().build();
      const [account] = await sql<
        Account[]
      >`INSERT INTO accounts (address, name, name_hash) VALUES (${createAccountDto.address}, ${createAccountDto.name}, ${faker.string.alphanumeric(32)}) RETURNING *`;
      const addressBookItem = await target.createAddressBookItem({
        account,
        createAddressBookItemDto: {
          // TODO: builder
          name: faker.string.alphanumeric(),
          address: getAddress(faker.finance.ethereumAddress()),
        },
      });
      expect(addressBookItem).toMatchObject({
        id: expect.any(Number),
        data: expect.any(Buffer), // TODO: this should be decrypted
        accountId: account.id,
      }); // TODO: this should be an item, not the whole address book
    });
  });
});
