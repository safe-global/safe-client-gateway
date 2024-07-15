import { TestDbFactory } from '@/__tests__/db.factory';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { AccountsDatasource } from '@/datasources/accounts/accounts.datasource';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { PostgresDatabaseMigrator } from '@/datasources/db/postgres-database.migrator';
import { accountDataTypeBuilder } from '@/domain/accounts/entities/__tests__/account-data-type.builder';
import { upsertAccountDataSettingsDtoBuilder } from '@/domain/accounts/entities/__tests__/upsert-account-data-settings.dto.entity.builder';
import { AccountDataType } from '@/domain/accounts/entities/account-data-type.entity';
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

describe('AccountsDatasource tests', () => {
  let fakeCacheService: FakeCacheService;
  let sql: postgres.Sql;
  let migrator: PostgresDatabaseMigrator;
  let target: AccountsDatasource;
  const testDbFactory = new TestDbFactory();

  beforeAll(async () => {
    fakeCacheService = new FakeCacheService();
    sql = await testDbFactory.createTestDatabase(faker.string.uuid());
    migrator = new PostgresDatabaseMigrator(sql);
    await migrator.migrate();
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'expirationTimeInSeconds.default') return faker.number.int();
    });

    target = new AccountsDatasource(
      fakeCacheService,
      sql,
      mockLoggingService,
      mockConfigurationService,
    );
  });

  afterEach(async () => {
    await sql`TRUNCATE TABLE accounts, groups, account_data_types CASCADE`;
    fakeCacheService.clear();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testDbFactory.destroyTestDatabase(sql);
  });

  describe('createAccount', () => {
    it('creates an account successfully', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      const result = await target.createAccount(address);

      expect(result).toStrictEqual({
        id: expect.any(Number),
        group_id: null,
        address,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });

      // check the account is stored in the cache
      const cacheDir = new CacheDir(`account_${address}`, '');
      const cacheContent = await fakeCacheService.get(cacheDir);
      expect(JSON.parse(cacheContent as string)).toStrictEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            group_id: null,
            address,
          }),
        ]),
      );
    });

    it('throws when an account with the same address already exists', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      await target.createAccount(address);

      await expect(target.createAccount(address)).rejects.toThrow(
        'Error creating account.',
      );
    });
  });

  describe('getAccount', () => {
    it('returns an account successfully', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      await target.createAccount(address);

      const result = await target.getAccount(address);

      expect(result).toStrictEqual(
        expect.objectContaining({
          id: expect.any(Number),
          group_id: null,
          address,
        }),
      );
    });

    it('returns an account from cache', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      await target.createAccount(address);

      // cache the account
      await target.getAccount(address);

      // delete the account from the database
      await sql`DELETE FROM accounts WHERE address = ${address}`;

      // check the account is still in the cache
      const result = await target.getAccount(address);

      expect(result).toStrictEqual(
        expect.objectContaining({
          id: expect.any(Number),
          group_id: null,
          address,
        }),
      );
    });

    it('should not cache if the account is not found', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      // should not cache the account
      await expect(target.getAccount(address)).rejects.toThrow();

      // insert the account into the database
      await sql`INSERT INTO accounts (address) VALUES (${address})`;

      // check the account is returned from the database
      const result = await target.getAccount(address);

      expect(result).toStrictEqual(
        expect.objectContaining({
          id: expect.any(Number),
          group_id: null,
          address,
        }),
      );
      expect(mockLoggingService.debug).toHaveBeenCalledTimes(2);
      // TODO: add types to ILoggingService
      expect(
        (mockLoggingService.debug.mock.calls[0][0] as { type: string }).type,
      ).toBe('cache_miss');
      expect(
        (mockLoggingService.debug.mock.calls[1][0] as { type: string }).type,
      ).toBe('cache_miss');
    });

    it('throws if no account is found', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      await expect(target.getAccount(address)).rejects.toThrow(
        'Error getting account.',
      );
    });
  });

  describe('deleteAccount', () => {
    it('deletes an account successfully', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      await target.createAccount(address);

      await expect(target.deleteAccount(address)).resolves.not.toThrow();

      expect(mockLoggingService.debug).not.toHaveBeenCalled();
    });

    it('does not throws if no account is found', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      await expect(target.deleteAccount(address)).resolves.not.toThrow();

      expect(mockLoggingService.debug).toHaveBeenCalledTimes(1);
    });

    it('should clear the cache on account deletion', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      await target.createAccount(address);
      // get the account from the cache
      await target.getAccount(address);
      await expect(target.deleteAccount(address)).resolves.not.toThrow();

      // the account is deleted from the database and the cache
      await expect(target.getAccount(address)).rejects.toThrow();

      expect(mockLoggingService.debug).toHaveBeenCalledTimes(2);
      expect(
        (mockLoggingService.debug.mock.calls[0][0] as { type: string }).type,
      ).toBe('cache_hit');
      expect(
        (mockLoggingService.debug.mock.calls[1][0] as { type: string }).type,
      ).toBe('cache_miss');
    });
  });

  describe('getDataTypes', () => {
    it('returns all data types from the database successfully', async () => {
      const dataTypes = [
        { name: faker.lorem.slug() },
        { name: faker.lorem.slug() },
        { name: faker.lorem.slug() },
      ];
      await sql`
        INSERT INTO account_data_types ${sql(dataTypes, 'name')}`;

      const result = await target.getDataTypes();

      expect(result).toStrictEqual(
        expect.arrayContaining(
          dataTypes.map((dataType) =>
            expect.objectContaining({
              id: expect.any(Number),
              name: dataType.name,
              description: null,
              is_active: true,
            }),
          ),
        ),
      );
    });

    it('returns all data types from cache successfully', async () => {
      const dataTypes = [
        { name: faker.lorem.slug() },
        { name: faker.lorem.slug() },
        { name: faker.lorem.slug() },
      ];
      const rows = await sql`
        INSERT INTO account_data_types ${sql(dataTypes, 'name')} RETURNING (id)`;

      // cache the data types
      await target.getDataTypes();

      // delete the data types from the database
      await sql`
        DELETE FROM account_data_types WHERE id 
          IN ${sql(rows.map((id) => id.id))}`;

      // check the data types are still in the cache
      const result = await target.getDataTypes();

      expect(result).toStrictEqual(
        expect.arrayContaining(
          dataTypes.map((dataType) =>
            expect.objectContaining({
              id: expect.any(Number),
              name: dataType.name,
              description: null,
              is_active: true,
            }),
          ),
        ),
      );
    });

    it('returns active data types from the database successfully', async () => {
      const dataTypes = [
        { name: faker.lorem.slug() },
        { name: faker.lorem.slug() },
        { name: faker.lorem.slug() },
      ];
      await sql`
        INSERT INTO account_data_types ${sql(dataTypes, 'name')}`;

      const result = await target.getActiveDataTypes();

      expect(result).toStrictEqual(
        expect.arrayContaining(
          dataTypes.map((dataType) =>
            expect.objectContaining({
              id: expect.any(Number),
              name: dataType.name,
              description: null,
              is_active: true,
            }),
          ),
        ),
      );
    });

    it('returns active data types from cache successfully', async () => {
      const dataTypes = [
        { name: faker.lorem.slug() },
        { name: faker.lorem.slug() },
        { name: faker.lorem.slug() },
      ];
      const rows = await sql`
        INSERT INTO account_data_types ${sql(dataTypes, 'name')} RETURNING (id)`;

      // cache the data types
      await target.getActiveDataTypes();

      // delete the data types from the database
      await sql`
        DELETE FROM account_data_types WHERE id 
          IN ${sql(rows.map((id) => id.id))}`;

      // check the data types are still in the cache
      const result = await target.getActiveDataTypes();

      expect(result).toStrictEqual(
        expect.arrayContaining(
          dataTypes.map((dataType) =>
            expect.objectContaining({
              id: expect.any(Number),
              name: dataType.name,
              description: null,
              is_active: true,
            }),
          ),
        ),
      );
    });
  });

  describe('getAccountDataSettings', () => {
    it('should get the account data settings successfully', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const account = await target.createAccount(address);
      const accountDataTypes = Array.from(
        { length: faker.number.int({ min: 1, max: 4 }) },
        () => accountDataTypeBuilder().with('is_active', true).build(),
      );
      const insertedDataTypes =
        await sql`INSERT INTO account_data_types ${sql(accountDataTypes, 'name', 'is_active')} returning *`;
      const accountDataSettingRows = insertedDataTypes.map((dataType) => ({
        account_id: account.id,
        account_data_type_id: dataType.id,
        enabled: faker.datatype.boolean(),
      }));
      await sql`
        INSERT INTO account_data_settings 
        ${sql(accountDataSettingRows, 'account_id', 'account_data_type_id', 'enabled')} returning *`;

      const actual = await target.getAccountDataSettings(address);

      const expected = accountDataSettingRows.map((accountDataSettingRow) => ({
        account_id: account.id,
        account_data_type_id: accountDataSettingRow.account_data_type_id,
        enabled: accountDataSettingRow.enabled,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      }));

      expect(actual).toStrictEqual(expect.arrayContaining(expected));
    });

    it('should get the account data settings from cache', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const account = await target.createAccount(address);
      const accountDataTypes = Array.from(
        { length: faker.number.int({ min: 1, max: 4 }) },
        () => accountDataTypeBuilder().with('is_active', true).build(),
      );
      const insertedDataTypes =
        await sql`INSERT INTO account_data_types ${sql(accountDataTypes, 'name', 'is_active')} returning *`;
      const accountDataSettingRows = insertedDataTypes.map((dataType) => ({
        account_id: account.id,
        account_data_type_id: dataType.id,
        enabled: faker.datatype.boolean(),
      }));
      await sql`
        INSERT INTO account_data_settings
        ${sql(accountDataSettingRows, 'account_id', 'account_data_type_id', 'enabled')} returning *`;

      // cache the account data settings
      await target.getAccountDataSettings(address);

      // delete the account data settings
      await sql`DELETE FROM account_data_settings`;

      // check the account data settings are still in the cache
      const actual = await target.getAccountDataSettings(address);

      const expected = accountDataSettingRows.map((accountDataSettingRow) =>
        expect.objectContaining({
          account_id: account.id,
          account_data_type_id: accountDataSettingRow.account_data_type_id,
          enabled: accountDataSettingRow.enabled,
        }),
      );

      expect(actual).toStrictEqual(expect.arrayContaining(expected));
    });

    it('should omit account data settings which data type is not active', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const account = await target.createAccount(address);
      const accountDataTypes = Array.from(
        { length: faker.number.int({ min: 1, max: 4 }) },
        () => accountDataTypeBuilder().with('is_active', true).build(),
      );
      accountDataTypes.push(
        accountDataTypeBuilder().with('is_active', false).build(),
      );
      const insertedDataTypes =
        await sql`INSERT INTO account_data_types ${sql(accountDataTypes, 'name', 'is_active')} returning *`;
      const [inactiveDataType] = await sql<
        AccountDataType[]
      >`SELECT * FROM account_data_types WHERE is_active IS FALSE`;
      const accountDataSettingRows = insertedDataTypes.map((dataType) => ({
        account_id: account.id,
        account_data_type_id: dataType.id,
        enabled: faker.datatype.boolean(),
      }));
      await sql`
        INSERT INTO account_data_settings 
        ${sql(accountDataSettingRows, 'account_id', 'account_data_type_id', 'enabled')} returning *`;

      const actual = await target.getAccountDataSettings(address);

      const expected = accountDataSettingRows
        .map((accountDataSettingRow) => ({
          account_id: account.id,
          account_data_type_id: accountDataSettingRow.account_data_type_id,
          enabled: accountDataSettingRow.enabled,
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        }))
        .filter((ads) => ads.account_data_type_id !== inactiveDataType.id);

      expect(actual).toStrictEqual(expect.arrayContaining(expected));
    });
  });

  describe('upsertAccountDataSettings', () => {
    it('adds account data settings successfully', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const account = await target.createAccount(address);
      const accountDataTypes = Array.from(
        { length: faker.number.int({ min: 1, max: 4 }) },
        () => accountDataTypeBuilder().with('is_active', true).build(),
      );
      const insertedDataTypes =
        await sql`INSERT INTO account_data_types ${sql(accountDataTypes, 'name', 'is_active')} returning *`;
      const accountDataSettings = insertedDataTypes.map((dataType) => ({
        id: dataType.id,
        enabled: faker.datatype.boolean(),
      }));
      const upsertAccountDataSettingsDto = upsertAccountDataSettingsDtoBuilder()
        .with('accountDataSettings', accountDataSettings)
        .build();

      const actual = await target.upsertAccountDataSettings(
        address,
        upsertAccountDataSettingsDto,
      );

      const expected = accountDataSettings.map((accountDataSetting) => ({
        account_id: account.id,
        account_data_type_id: accountDataSetting.id,
        enabled: accountDataSetting.enabled,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      }));

      expect(actual).toStrictEqual(expect.arrayContaining(expected));
    });

    it('should write the associated cache on upsert', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const account = await target.createAccount(address);
      const accountDataTypes = Array.from(
        { length: faker.number.int({ min: 1, max: 4 }) },
        () => accountDataTypeBuilder().with('is_active', true).build(),
      );
      const insertedDataTypes =
        await sql`INSERT INTO account_data_types ${sql(accountDataTypes, 'name', 'is_active')} returning *`;
      const accountDataSettings = insertedDataTypes.map((dataType) => ({
        id: dataType.id,
        enabled: faker.datatype.boolean(),
      }));
      const upsertAccountDataSettingsDto = upsertAccountDataSettingsDtoBuilder()
        .with('accountDataSettings', accountDataSettings)
        .build();

      await target.upsertAccountDataSettings(
        address,
        upsertAccountDataSettingsDto,
      );

      // check the account data settings are stored in the cache
      const cacheDir = new CacheDir(`account_data_settings_${address}`, '');
      const cacheContent = await fakeCacheService.get(cacheDir);
      expect(JSON.parse(cacheContent as string)).toStrictEqual(
        expect.arrayContaining(
          accountDataSettings.map((accountDataSetting) =>
            expect.objectContaining({
              account_id: account.id,
              account_data_type_id: accountDataSetting.id,
              enabled: accountDataSetting.enabled,
            }),
          ),
        ),
      );
    });

    it('updates existing account data settings successfully', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const account = await target.createAccount(address);
      const accountDataTypes = Array.from(
        { length: faker.number.int({ min: 1, max: 4 }) },
        () => accountDataTypeBuilder().with('is_active', true).build(),
      );
      const insertedDataTypes =
        await sql`INSERT INTO account_data_types ${sql(accountDataTypes, 'name', 'is_active')} returning *`;
      const accountDataSettings = insertedDataTypes.map((dataType) => ({
        id: dataType.id,
        enabled: faker.datatype.boolean(),
      }));
      const upsertAccountDataSettingsDto = upsertAccountDataSettingsDtoBuilder()
        .with('accountDataSettings', accountDataSettings)
        .build();

      const beforeUpdate = await target.upsertAccountDataSettings(
        address,
        upsertAccountDataSettingsDto,
      );

      expect(beforeUpdate).toStrictEqual(
        expect.arrayContaining(
          accountDataSettings.map((accountDataSetting) => ({
            account_id: account.id,
            account_data_type_id: accountDataSetting.id,
            enabled: accountDataSetting.enabled,
            created_at: expect.any(Date),
            updated_at: expect.any(Date),
          })),
        ),
      );

      const accountDataSettings2 = accountDataSettings.map((ads) => ({
        ...ads,
        enabled: !ads.enabled,
      }));
      const upsertAccountDataSettingsDto2 =
        upsertAccountDataSettingsDtoBuilder()
          .with('accountDataSettings', accountDataSettings2)
          .build();

      const afterUpdate = await target.upsertAccountDataSettings(
        address,
        upsertAccountDataSettingsDto2,
      );

      expect(afterUpdate).toStrictEqual(
        expect.arrayContaining(
          accountDataSettings.map((accountDataSetting) => ({
            account_id: account.id,
            account_data_type_id: accountDataSetting.id,
            enabled: !accountDataSetting.enabled, // 'enabled' row was updated
            created_at: expect.any(Date),
            updated_at: expect.any(Date),
          })),
        ),
      );
    });

    it('throws an error if the account does not exist', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const accountDataTypes = Array.from(
        { length: faker.number.int({ min: 1, max: 4 }) },
        () => accountDataTypeBuilder().with('is_active', true).build(),
      );
      const insertedDataTypes =
        await sql`INSERT INTO account_data_types ${sql(accountDataTypes, 'name', 'is_active')} returning *`;
      const accountDataSettings = insertedDataTypes.map((dataType) => ({
        id: dataType.id,
        enabled: faker.datatype.boolean(),
      }));
      const upsertAccountDataSettingsDto = upsertAccountDataSettingsDtoBuilder()
        .with('accountDataSettings', accountDataSettings)
        .build();

      await expect(
        target.upsertAccountDataSettings(address, upsertAccountDataSettingsDto),
      ).rejects.toThrow('Error getting account.');
    });

    it('throws an error if a non-existent data type is provided', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      await target.createAccount(address);
      const accountDataTypes = Array.from(
        { length: faker.number.int({ min: 1, max: 4 }) },
        () => accountDataTypeBuilder().with('is_active', true).build(),
      );
      const insertedDataTypes =
        await sql`INSERT INTO account_data_types ${sql(accountDataTypes, 'name', 'is_active')} returning *`;
      const accountDataSettings = insertedDataTypes.map((dataType) => ({
        id: dataType.id,
        enabled: faker.datatype.boolean(),
      }));
      const upsertAccountDataSettingsDto = upsertAccountDataSettingsDtoBuilder()
        .with('accountDataSettings', accountDataSettings)
        .build();
      upsertAccountDataSettingsDto.accountDataSettings.push({
        id: faker.string.numeric(5),
        enabled: faker.datatype.boolean(),
      });

      await expect(
        target.upsertAccountDataSettings(address, upsertAccountDataSettingsDto),
      ).rejects.toThrow('Data types not found or not active.');
    });

    it('throws an error if an inactive data type is provided', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      await target.createAccount(address);
      const accountDataTypes = [
        accountDataTypeBuilder().with('is_active', false).build(),
        accountDataTypeBuilder().build(),
      ];
      const insertedDataTypes =
        await sql`INSERT INTO account_data_types ${sql(accountDataTypes, 'name', 'is_active')} returning *`;
      const accountDataSettings = insertedDataTypes.map((dataType) => ({
        id: dataType.id,
        enabled: faker.datatype.boolean(),
      }));
      const upsertAccountDataSettingsDto = upsertAccountDataSettingsDtoBuilder()
        .with('accountDataSettings', accountDataSettings)
        .build();

      await expect(
        target.upsertAccountDataSettings(address, upsertAccountDataSettingsDto),
      ).rejects.toThrow(`Data types not found or not active.`);
    });
  });
});
