import { TestDbFactory } from '@/__tests__/db.factory';
import { PostgresDatabaseMigrator } from '@/datasources/db/postgres-database.migrator';
import { faker } from '@faker-js/faker';
import postgres from 'postgres';
import { getAddress } from 'viem';

interface AccountRow {
  id: number;
  group_id: number;
  created_at: Date;
  updated_at: Date;
  address: `0x${string}`;
}

interface AccountDataTypeRow {
  id: number;
  created_at: Date;
  updated_at: Date;
  name: string;
  description: string;
  is_active: boolean;
}

interface AccountDataSettingsRow {
  created_at: Date;
  updated_at: Date;
  account_data_type_id: number;
  account_id: number;
  enabled: boolean;
}

describe('Migration 00003_account-data-settings', () => {
  let sql: postgres.Sql;
  let migrator: PostgresDatabaseMigrator;
  const testDbFactory = new TestDbFactory();

  beforeAll(async () => {
    sql = await testDbFactory.createTestDatabase(faker.string.uuid());
    migrator = new PostgresDatabaseMigrator(sql);
  });

  afterAll(async () => {
    await testDbFactory.destroyTestDatabase(sql);
  });

  it('runs successfully', async () => {
    const result = await migrator.test({
      migration: '00003_account-data-settings',
      after: async (sql: postgres.Sql) => {
        return {
          account_data_types: {
            columns:
              await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'account_data_settings'`,
            rows: await sql`SELECT * FROM account_data_settings`,
          },
        };
      },
    });
    expect(result.after).toStrictEqual({
      account_data_types: {
        columns: expect.arrayContaining([
          { column_name: 'created_at' },
          { column_name: 'updated_at' },
          { column_name: 'account_data_type_id' },
          { column_name: 'account_id' },
          { column_name: 'enabled' },
        ]),
        rows: [],
      },
    });
  });

  it('should add one AccountDataSettings and update its row timestamps', async () => {
    const accountAddress = getAddress(faker.finance.ethereumAddress());
    const name = faker.lorem.word();
    let accountRows: AccountRow[] = [];
    let accountDataTypeRows: AccountDataTypeRow[] = [];

    const {
      after: accountDataSettingRows,
    }: { after: AccountDataSettingsRow[] } = await migrator.test({
      migration: '00003_account-data-settings',
      after: async (sql: postgres.Sql): Promise<AccountDataSettingsRow[]> => {
        accountRows = await sql<
          AccountRow[]
        >`INSERT INTO accounts (address) VALUES (${accountAddress}) RETURNING *;`;
        accountDataTypeRows = await sql<
          AccountDataTypeRow[]
        >`INSERT INTO account_data_types (name) VALUES (${name}) RETURNING *;`;
        return sql<
          AccountDataSettingsRow[]
        >`INSERT INTO account_data_settings (account_id, account_data_type_id) VALUES (${accountRows[0].id}, ${accountDataTypeRows[0].id}) RETURNING *;`;
      },
    });

    expect(accountDataSettingRows[0]).toMatchObject({
      account_id: accountRows[0].id,
      account_data_type_id: accountDataTypeRows[0].id,
      enabled: false,
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });

    // created_at and updated_at should be the same after the row is created
    const createdAt = new Date(accountDataSettingRows[0].created_at);
    const updatedAt = new Date(accountDataSettingRows[0].updated_at);
    expect(createdAt).toBeInstanceOf(Date);
    expect(createdAt).toStrictEqual(updatedAt);

    // only updated_at should be updated after the row is updated
    const afterUpdate = await sql<
      AccountDataTypeRow[]
    >`UPDATE account_data_settings
      SET enabled = true
      WHERE account_id = ${accountDataSettingRows[0].account_id}
        AND account_data_type_id = ${accountDataSettingRows[0].account_data_type_id}
      RETURNING *;`;

    const updatedAtAfterUpdate = new Date(afterUpdate[0].updated_at);
    const createdAtAfterUpdate = new Date(afterUpdate[0].created_at);
    expect(createdAtAfterUpdate).toStrictEqual(createdAt);
    expect(updatedAtAfterUpdate.getTime()).toBeGreaterThan(createdAt.getTime());
  });
});
