import { TestDbFactory } from '@/__tests__/db.factory';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CounterfactualSafesDatasource } from '@/datasources/accounts/counterfactual-safes/counterfactual-safes.datasource';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { PostgresDatabaseMigrator } from '@/datasources/db/postgres-database.migrator';
import { createCounterfactualSafeDtoBuilder } from '@/domain/accounts/counterfactual-safes/entities/__tests__/create-counterfactual-safe.dto.entity.builder';
import { accountBuilder } from '@/domain/accounts/entities/__tests__/account.builder';
import { AccountDataType } from '@/domain/accounts/entities/account-data-type.entity';
import { Account } from '@/domain/accounts/entities/account.entity';
import { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import postgres from 'postgres';
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

describe('CounterfactualSafesDatasource tests', () => {
  let fakeCacheService: FakeCacheService;
  let sql: postgres.Sql;
  let migrator: PostgresDatabaseMigrator;
  let target: CounterfactualSafesDatasource;
  const testDbFactory = new TestDbFactory();

  beforeAll(async () => {
    fakeCacheService = new FakeCacheService();
    sql = await testDbFactory.createTestDatabase(faker.string.uuid());
    migrator = new PostgresDatabaseMigrator(sql);
    await migrator.migrate();
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'expirationTimeInSeconds.default') return faker.number.int();
    });

    target = new CounterfactualSafesDatasource(
      fakeCacheService,
      sql,
      mockLoggingService,
      mockConfigurationService,
    );
  });

  afterEach(async () => {
    await sql`TRUNCATE TABLE accounts, account_data_settings, counterfactual_safes CASCADE`;
    fakeCacheService.clear();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testDbFactory.destroyTestDatabase(sql);
  });

  describe('createCounterfactualSafe', () => {
    it('should create a counterfactual safe', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const [account] = await sql<
        Account[]
      >`INSERT INTO accounts (address) VALUES (${address}) RETURNING *`;
      const createCounterfactualSafeDto =
        createCounterfactualSafeDtoBuilder().build();

      const actual = await target.createCounterfactualSafe(
        account,
        createCounterfactualSafeDto,
      );
      expect(actual).toStrictEqual(
        expect.objectContaining({
          id: expect.any(Number),
          chain_id: createCounterfactualSafeDto.chainId,
          creator: account.address,
          fallback_handler: createCounterfactualSafeDto.fallbackHandler,
          owners: createCounterfactualSafeDto.owners,
          predicted_address: createCounterfactualSafeDto.predictedAddress,
          salt_nonce: createCounterfactualSafeDto.saltNonce,
          singleton_address: createCounterfactualSafeDto.singletonAddress,
          threshold: createCounterfactualSafeDto.threshold,
          account_id: account.id,
        }),
      );
    });

    it('should delete the cache for the account counterfactual safes', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const [account] = await sql<
        Account[]
      >`INSERT INTO accounts (address) VALUES (${address}) RETURNING *`;
      await target.createCounterfactualSafe(
        account,
        createCounterfactualSafeDtoBuilder().build(),
      );
      await target.getCounterfactualSafesForAccount(account);

      // check CF Safes for the address are in the cache
      const cacheDir = new CacheDir(`counterfactual_safes_${address}`, '');
      const cacheContent = await fakeCacheService.get(cacheDir);
      expect(JSON.parse(cacheContent as string)).toHaveLength(1);

      // the cache is cleared after creating a new CF Safe for the same account
      await target.createCounterfactualSafe(
        account,
        createCounterfactualSafeDtoBuilder().build(),
      );
      const afterCreation = await fakeCacheService.get(cacheDir);
      expect(afterCreation).toBeUndefined();
    });

    // TODO: move this check to the repository.
    it.skip('should throw if the counterfactual-safes storage setting is disabled', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const [account] = await sql<
        Account[]
      >`INSERT INTO accounts (address) VALUES (${address}) RETURNING *`;
      const [counterfactualSafesDataType] = await sql<
        AccountDataType[]
      >`SELECT * FROM account_data_types WHERE name = 'CounterfactualSafes'`;
      await sql`
        INSERT INTO account_data_settings
        ${sql([
          {
            account_id: account.id,
            account_data_type_id: counterfactualSafesDataType.id,
            enabled: false,
          },
        ])}`;

      expect(
        await target.createCounterfactualSafe(
          account,
          createCounterfactualSafeDtoBuilder().build(),
        ),
      ).toThrow();
    });
  });

  describe('getCounterfactualSafe', () => {
    it('should get a counterfactual safe', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const [account] = await sql<
        Account[]
      >`INSERT INTO accounts (address) VALUES (${address}) RETURNING *`;
      const counterfactualSafe = await target.createCounterfactualSafe(
        account,
        createCounterfactualSafeDtoBuilder().build(),
      );

      const actual = await target.getCounterfactualSafe(
        counterfactualSafe.id.toString(),
      );
      expect(actual).toStrictEqual(counterfactualSafe);
    });

    it('returns a counterfactual safe from cache', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const [account] = await sql<
        Account[]
      >`INSERT INTO accounts (address) VALUES (${address}) RETURNING *`;
      const counterfactualSafe = await target.createCounterfactualSafe(
        account,
        createCounterfactualSafeDtoBuilder().build(),
      );

      // first call is not cached
      const actual = await target.getCounterfactualSafe(
        counterfactualSafe.id.toString(),
      );
      await target.getCounterfactualSafe(counterfactualSafe.id.toString());

      expect(actual).toStrictEqual(counterfactualSafe);
      const cacheDir = new CacheDir(
        `counterfactual_safe_${counterfactualSafe.id}`,
        '',
      );
      const cacheContent = await fakeCacheService.get(cacheDir);
      expect(cacheContent).toStrictEqual(JSON.stringify([counterfactualSafe]));
      expect(mockLoggingService.debug).toHaveBeenCalledTimes(2);
      expect(mockLoggingService.debug).toHaveBeenNthCalledWith(1, {
        type: 'cache_miss',
        key: `counterfactual_safe_${counterfactualSafe.id}`,
        field: '',
      });
      expect(mockLoggingService.debug).toHaveBeenNthCalledWith(2, {
        type: 'cache_hit',
        key: `counterfactual_safe_${counterfactualSafe.id}`,
        field: '',
      });
    });

    it('should not cache if the counterfactualSafe is not found', async () => {
      const id = faker.string.numeric();

      // should not cache the counterfactualSafe
      await expect(target.getCounterfactualSafe(id)).rejects.toThrow(
        'Error getting Counterfactual Safe.',
      );
      await expect(target.getCounterfactualSafe(id)).rejects.toThrow(
        'Error getting Counterfactual Safe.',
      );

      expect(mockLoggingService.debug).toHaveBeenCalledTimes(2);
      expect(mockLoggingService.debug).toHaveBeenNthCalledWith(1, {
        type: 'cache_miss',
        key: `counterfactual_safe_${id}`,
        field: '',
      });
      expect(mockLoggingService.debug).toHaveBeenNthCalledWith(2, {
        type: 'cache_miss',
        key: `counterfactual_safe_${id}`,
        field: '',
      });
    });
  });

  describe('getCounterfactualSafesForAccount', () => {
    it('should get the counterfactual safes for an account', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const [account] = await sql<
        Account[]
      >`INSERT INTO accounts (address) VALUES (${address}) RETURNING *`;
      const counterfactualSafes = await Promise.all([
        target.createCounterfactualSafe(
          account,
          createCounterfactualSafeDtoBuilder().with('chainId', '1').build(),
        ),
        target.createCounterfactualSafe(
          account,
          createCounterfactualSafeDtoBuilder().with('chainId', '2').build(),
        ),
      ]);

      const actual = await target.getCounterfactualSafesForAccount(account);
      expect(actual).toStrictEqual(expect.arrayContaining(counterfactualSafes));
    });

    it('should get the counterfactual safes for an account from cache', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const [account] = await sql<
        Account[]
      >`INSERT INTO accounts (address) VALUES (${address}) RETURNING *`;
      const counterfactualSafes = await Promise.all([
        target.createCounterfactualSafe(
          account,
          createCounterfactualSafeDtoBuilder().with('chainId', '1').build(),
        ),
        target.createCounterfactualSafe(
          account,
          createCounterfactualSafeDtoBuilder().with('chainId', '2').build(),
        ),
      ]);

      // first call is not cached
      const actual = await target.getCounterfactualSafesForAccount(account);
      await target.getCounterfactualSafesForAccount(account);

      expect(actual).toStrictEqual(expect.arrayContaining(counterfactualSafes));
      const cacheDir = new CacheDir(`counterfactual_safes_${address}`, '');
      const cacheContent = await fakeCacheService.get(cacheDir);
      expect(JSON.parse(cacheContent as string)).toHaveLength(2);
      expect(mockLoggingService.debug).toHaveBeenCalledTimes(2);
      expect(mockLoggingService.debug).toHaveBeenNthCalledWith(1, {
        type: 'cache_miss',
        key: `counterfactual_safes_${account.address}`,
        field: '',
      });
      expect(mockLoggingService.debug).toHaveBeenNthCalledWith(2, {
        type: 'cache_hit',
        key: `counterfactual_safes_${account.address}`,
        field: '',
      });
    });
  });

  describe('deleteCounterfactualSafe', () => {
    it('deletes a counterfactualSafe successfully', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const [account] = await sql<
        Account[]
      >`INSERT INTO accounts (address) VALUES (${address}) RETURNING *`;
      const counterfactualSafe = await target.createCounterfactualSafe(
        account,
        createCounterfactualSafeDtoBuilder().build(),
      );

      await expect(
        target.deleteCounterfactualSafe(
          account,
          counterfactualSafe.id.toString(),
        ),
      ).resolves.not.toThrow();

      expect(mockLoggingService.debug).not.toHaveBeenCalled();
    });

    it('does not throws if no Counterfactual Safe is found', async () => {
      await expect(
        target.deleteCounterfactualSafe(
          accountBuilder().build(),
          faker.string.numeric(),
        ),
      ).resolves.not.toThrow();

      expect(mockLoggingService.debug).toHaveBeenCalledTimes(1);
    });

    it('should clear the cache on Counterfactual Safe deletion', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const [account] = await sql<
        Account[]
      >`INSERT INTO accounts (address) VALUES (${address}) RETURNING *`;
      const counterfactualSafe = await target.createCounterfactualSafe(
        account,
        createCounterfactualSafeDtoBuilder().build(),
      );

      // the counterfactual safe is cached
      await target.getCounterfactualSafe(counterfactualSafe.id.toString());
      const cacheDir = new CacheDir(
        `counterfactual_safe_${counterfactualSafe.id}`,
        '',
      );
      const beforeDeletion = await fakeCacheService.get(cacheDir);
      expect(beforeDeletion).toStrictEqual(
        JSON.stringify([counterfactualSafe]),
      );

      // the counterfactualSafe is deleted from the database and the cache
      await expect(
        target.deleteCounterfactualSafe(
          account,
          counterfactualSafe.id.toString(),
        ),
      ).resolves.not.toThrow();
      await expect(
        target.getCounterfactualSafe(counterfactualSafe.id.toString()),
      ).rejects.toThrow();

      const afterDeletion = await fakeCacheService.get(cacheDir);
      expect(afterDeletion).toBeUndefined();
      const cacheDirByAddress = new CacheDir(
        `counterfactual_safes_${address}`,
        '',
      );
      const cachedByAddress = await fakeCacheService.get(cacheDirByAddress);
      expect(cachedByAddress).toBeUndefined();
    });
  });

  // TODO: tests for deleteCounterfactualSafesForAccount
});
