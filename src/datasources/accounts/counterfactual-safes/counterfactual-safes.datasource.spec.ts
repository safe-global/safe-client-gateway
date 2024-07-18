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
    it('should create a Counterfactual Safe', async () => {
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
          chain_id: createCounterfactualSafeDto.chain_id,
          creator: account.address,
          fallback_handler: createCounterfactualSafeDto.fallback_handler,
          owners: createCounterfactualSafeDto.owners,
          predicted_address: createCounterfactualSafeDto.predicted_address,
          salt_nonce: createCounterfactualSafeDto.salt_nonce,
          singleton_address: createCounterfactualSafeDto.singleton_address,
          threshold: createCounterfactualSafeDto.threshold,
          account_id: account.id,
        }),
      );
    });

    it('should delete the cache for the account Counterfactual Safes', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const [account] = await sql<
        Account[]
      >`INSERT INTO accounts (address) VALUES (${address}) RETURNING *`;
      await target.createCounterfactualSafe(
        account,
        createCounterfactualSafeDtoBuilder().build(),
      );
      await target.getCounterfactualSafesForAccount(account);
      const cacheDir = new CacheDir(`counterfactual_safes_${address}`, '');
      await fakeCacheService.set(
        cacheDir,
        JSON.stringify([]),
        faker.number.int(),
      );

      // the cache is cleared after creating a new CF Safe for the same account
      await target.createCounterfactualSafe(
        account,
        createCounterfactualSafeDtoBuilder().build(),
      );
      expect(await fakeCacheService.get(cacheDir)).toBeUndefined();
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
    it('should get a Counterfactual Safe', async () => {
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

    it('returns a Counterfactual Safe from cache', async () => {
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
      expect(JSON.parse(cacheContent as string)).toHaveLength(1);
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

    it('should not cache if the Counterfactual Safe is not found', async () => {
      const id = faker.string.numeric();

      // should not cache the Counterfactual Safe
      await expect(target.getCounterfactualSafe(id)).rejects.toThrow(
        'Error getting Counterfactual Safe.',
      );
      await expect(target.getCounterfactualSafe(id)).rejects.toThrow(
        'Error getting Counterfactual Safe.',
      );

      const cacheDir = new CacheDir(`counterfactual_safe_${id}`, '');
      expect(await fakeCacheService.get(cacheDir)).toBeUndefined();
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
    it('should get the Counterfactual Safes for an account', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const [account] = await sql<
        Account[]
      >`INSERT INTO accounts (address) VALUES (${address}) RETURNING *`;
      const counterfactualSafes = await Promise.all([
        target.createCounterfactualSafe(
          account,
          createCounterfactualSafeDtoBuilder().with('chain_id', '1').build(),
        ),
        target.createCounterfactualSafe(
          account,
          createCounterfactualSafeDtoBuilder().with('chain_id', '2').build(),
        ),
      ]);

      const actual = await target.getCounterfactualSafesForAccount(account);
      expect(actual).toStrictEqual(expect.arrayContaining(counterfactualSafes));
    });

    it('should get the Counterfactual Safes for an account from cache', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const [account] = await sql<
        Account[]
      >`INSERT INTO accounts (address) VALUES (${address}) RETURNING *`;
      const counterfactualSafes = await Promise.all([
        target.createCounterfactualSafe(
          account,
          createCounterfactualSafeDtoBuilder().with('chain_id', '1').build(),
        ),
        target.createCounterfactualSafe(
          account,
          createCounterfactualSafeDtoBuilder().with('chain_id', '2').build(),
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
    it('should delete a Counterfactual Safe', async () => {
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

    it('should not throw if no Counterfactual Safe is found', async () => {
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

      // the Counterfactual Safe is cached
      await target.getCounterfactualSafe(counterfactualSafe.id.toString());
      const cacheDir = new CacheDir(
        `counterfactual_safe_${counterfactualSafe.id}`,
        '',
      );
      const beforeDeletion = await fakeCacheService.get(cacheDir);
      expect(JSON.parse(beforeDeletion as string)).toHaveLength(1);

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

  describe('deleteCounterfactualSafesForAccount', () => {
    it('should delete all the Counterfactual Safes for an account', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const [account] = await sql<
        Account[]
      >`INSERT INTO accounts (address) VALUES (${address}) RETURNING *`;
      const counterfactualSafes = await Promise.all([
        target.createCounterfactualSafe(
          account,
          createCounterfactualSafeDtoBuilder().with('chain_id', '1').build(),
        ),
        target.createCounterfactualSafe(
          account,
          createCounterfactualSafeDtoBuilder().with('chain_id', '2').build(),
        ),
      ]);

      // store data in the cache dirs
      const counterfactualSafesCacheDir = new CacheDir(
        `counterfactual_safes_${address}`,
        faker.string.alpha(),
      );
      const counterfactualSafeCacheDirs = [
        new CacheDir(
          `counterfactual_safe_${counterfactualSafes[0].id}`,
          faker.string.alpha(),
        ),
        new CacheDir(
          `counterfactual_safe_${counterfactualSafes[1].id}`,
          faker.string.alpha(),
        ),
      ];

      await expect(
        target.deleteCounterfactualSafesForAccount(account),
      ).resolves.not.toThrow();

      // database is cleared
      const actual = await target.getCounterfactualSafesForAccount(account);
      expect(actual).toHaveLength(0);
      // cache is cleared
      expect(
        await fakeCacheService.get(counterfactualSafesCacheDir),
      ).toBeUndefined();
      expect(
        await fakeCacheService.get(counterfactualSafeCacheDirs[0]),
      ).toBeUndefined();
      expect(
        await fakeCacheService.get(counterfactualSafeCacheDirs[1]),
      ).toBeUndefined();
    });
  });
});
