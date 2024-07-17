import { TestDbFactory } from '@/__tests__/db.factory';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CounterfactualSafesDatasource } from '@/datasources/accounts/counterfactual-safes/counterfactual-safes.datasource';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { PostgresDatabaseMigrator } from '@/datasources/db/postgres-database.migrator';
import { createCounterfactualSafeDtoBuilder } from '@/domain/accounts/counterfactual-safes/entities/__tests__/create-counterfactual-safe.dto.entity.builder';
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
});
