import { TestDbFactory } from '@/__tests__/db.factory';
import { AccountsDatasource } from '@/datasources/accounts/accounts.datasource';
import { PostgresDatabaseMigrator } from '@/datasources/db/postgres-database.migrator';
import { upsertAccountDataSettingsDtoBuilder } from '@/domain/accounts/entities/__tests__/upsert-account-data-settings.dto.entity.builder';
import { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import postgres from 'postgres';
import { getAddress } from 'viem';

const mockLoggingService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('AccountsDatasource tests', () => {
  let target: AccountsDatasource;
  let migrator: PostgresDatabaseMigrator;
  let sql: postgres.Sql;
  const testDbFactory = new TestDbFactory();

  beforeAll(async () => {
    sql = await testDbFactory.createTestDatabase(faker.string.uuid());
    migrator = new PostgresDatabaseMigrator(sql);
    await migrator.migrate();
    target = new AccountsDatasource(sql, mockLoggingService);
  });

  afterEach(async () => {
    await sql`TRUNCATE TABLE accounts, groups, account_data_types CASCADE`;
  });

  afterAll(async () => {
    await testDbFactory.dropTestDatabase(sql);
    await testDbFactory.close();
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

      expect(result).toStrictEqual({
        id: expect.any(Number),
        group_id: null,
        address,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
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
  });

  describe('getDataTypes', () => {
    it('returns data types successfully', async () => {
      const dataTypeNames = [
        faker.lorem.slug(),
        faker.lorem.slug(),
        faker.lorem.slug(),
      ];
      await sql`
        INSERT INTO account_data_types (name) VALUES
        (${dataTypeNames[0]}),
        (${dataTypeNames[1]}),
        (${dataTypeNames[2]})
      `;

      const result = await target.getDataTypes();

      expect(result).toStrictEqual(
        expect.arrayContaining([
          {
            id: expect.any(Number),
            name: dataTypeNames[0],
            description: null,
            is_active: true,
            created_at: expect.any(Date),
            updated_at: expect.any(Date),
          },
          {
            id: expect.any(Number),
            name: dataTypeNames[1],
            description: null,
            is_active: true,
            created_at: expect.any(Date),
            updated_at: expect.any(Date),
          },
          {
            id: expect.any(Number),
            name: dataTypeNames[2],
            description: null,
            is_active: true,
            created_at: expect.any(Date),
            updated_at: expect.any(Date),
          },
        ]),
      );
    });
  });

  describe('upsertAccountDataSettings', () => {
    it('adds account data settings successfully', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const upsertAccountDataSettingsDto =
        upsertAccountDataSettingsDtoBuilder().build();
      const { accountDataSettings } = upsertAccountDataSettingsDto;
      const account = await target.createAccount(address);
      const dataTypeNames = accountDataSettings.map((ads) => ({
        name: ads.dataTypeName,
      }));
      const dataTypes =
        await sql`INSERT INTO account_data_types ${sql(dataTypeNames, 'name')} returning *`;

      const result = await target.upsertAccountDataSettings(
        address,
        upsertAccountDataSettingsDto,
      );

      expect(result).toStrictEqual(
        expect.arrayContaining(
          accountDataSettings.map((ads) => ({
            account_id: account.id,
            account_data_type_id: dataTypes.find(
              (dt) => dt.name === ads.dataTypeName,
            )?.id,
            enabled: ads.enabled,
            created_at: expect.any(Date),
            updated_at: expect.any(Date),
          })),
        ),
      );
    });

    it('updates existent account data settings successfully', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const upsertAccountDataSettingsDto =
        upsertAccountDataSettingsDtoBuilder().build();
      const { accountDataSettings } = upsertAccountDataSettingsDto;
      const account = await target.createAccount(address);
      const dataTypeNames = accountDataSettings.map((ads) => ({
        name: ads.dataTypeName,
      }));
      const dataTypes =
        await sql`INSERT INTO account_data_types ${sql(dataTypeNames, 'name')} returning *`;

      const beforeUpdate = await target.upsertAccountDataSettings(
        address,
        upsertAccountDataSettingsDto,
      );

      expect(beforeUpdate).toStrictEqual(
        expect.arrayContaining(
          accountDataSettings.map((ads) => ({
            account_id: account.id,
            account_data_type_id: dataTypes.find(
              (dt) => dt.name === ads.dataTypeName,
            )?.id,
            enabled: ads.enabled,
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
          accountDataSettings.map((ads) => ({
            account_id: account.id,
            account_data_type_id: dataTypes.find(
              (dt) => dt.name === ads.dataTypeName,
            )?.id,
            enabled: !ads.enabled, // 'enabled' row was updated
            created_at: expect.any(Date),
            updated_at: expect.any(Date),
          })),
        ),
      );
    });

    it('throws an error if the account does not exist', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const upsertAccountDataSettingsDto =
        upsertAccountDataSettingsDtoBuilder().build();
      const { accountDataSettings } = upsertAccountDataSettingsDto;
      const dataTypeNames = accountDataSettings.map((ads) => ({
        name: ads.dataTypeName,
      }));
      await sql`INSERT INTO account_data_types ${sql(dataTypeNames, 'name')} returning *`;

      await expect(
        target.upsertAccountDataSettings(address, upsertAccountDataSettingsDto),
      ).rejects.toThrow('Error getting account.');
    });

    it('throws an error if a non-existent data type is provided', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const upsertAccountDataSettingsDto =
        upsertAccountDataSettingsDtoBuilder().build();
      const { accountDataSettings } = upsertAccountDataSettingsDto;
      await target.createAccount(address);
      const dataTypeNames = accountDataSettings.map((ads) => ({
        name: ads.dataTypeName,
      }));
      await sql`INSERT INTO account_data_types ${sql(dataTypeNames, 'name')} returning *`;
      upsertAccountDataSettingsDto.accountDataSettings.push({
        dataTypeName: faker.lorem.slug(),
        enabled: faker.datatype.boolean(),
      });

      await expect(
        target.upsertAccountDataSettings(address, upsertAccountDataSettingsDto),
      ).rejects.toThrow('Invalid data type.');
    });

    it('throws an error if an inactive data type is provided', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const upsertAccountDataSettingsDto =
        upsertAccountDataSettingsDtoBuilder().build();
      const { accountDataSettings } = upsertAccountDataSettingsDto;
      await target.createAccount(address);
      const dataTypes = accountDataSettings.map((ads) => ({
        name: ads.dataTypeName,
        is_active: false,
      }));
      await sql`INSERT INTO account_data_types ${sql(dataTypes, 'name', 'is_active')} returning *`;

      await expect(
        target.upsertAccountDataSettings(address, upsertAccountDataSettingsDto),
      ).rejects.toThrow(`Data type ${dataTypes[0].name} is inactive.`);
    });
  });
});
