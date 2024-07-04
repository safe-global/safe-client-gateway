import { dbFactory } from '@/__tests__/db.factory';
import { PostgresDatabaseMigrator } from '@/datasources/db/postgres-database.migrator';
import { faker } from '@faker-js/faker';
import { Sql } from 'postgres';

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
  const sql = dbFactory();
  const migrator = new PostgresDatabaseMigrator(sql);

  beforeAll(async () => {
    await sql`DROP TABLE IF EXISTS account_data_types, account_data_settings CASCADE;`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('runs successfully', async () => {
    const result = await migrator.test({
      migration: '00003_account-data-settings',
      after: async (sql: Sql) => {
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
    const accountAddress = faker.finance.ethereumAddress();
    const dataTypeName = faker.lorem.word();
    await sql`INSERT INTO accounts (address) VALUES (${accountAddress});`;
    const [accountRow] = await sql<
      AccountRow[]
    >`SELECT * FROM accounts WHERE address = ${accountAddress};`;
    await sql`INSERT INTO account_data_types (name) VALUES (${dataTypeName});`;
    const [accountDataTypeRow] = await sql<
      AccountDataTypeRow[]
    >`SELECT * FROM account_data_types WHERE name = ${dataTypeName}`;

    const result: { before: unknown; after: AccountDataSettingsRow[] } =
      await migrator.test({
        migration: '00003_account-data-settings',
        after: async (sql: Sql): Promise<AccountDataSettingsRow[]> => {
          await sql`INSERT INTO account_data_settings (account_id, account_data_type_id) VALUES (${accountRow.id}, ${accountDataTypeRow.id});`;
          return await sql<
            AccountDataSettingsRow[]
          >`SELECT * FROM account_data_settings`;
        },
      });

    expect(result.after[0].account_id).toBe(accountRow.id);
    expect(result.after[0].account_data_type_id).toBe(accountDataTypeRow.id);
    expect(result.after[0].enabled).toBe(false);

    // created_at and updated_at should be the same after the row is created
    const createdAt = new Date(result.after[0].created_at);
    const updatedAt = new Date(result.after[0].updated_at);
    expect(createdAt).toBeInstanceOf(Date);
    expect(createdAt).toStrictEqual(updatedAt);

    // only updated_at should be updated after the row is updated
    await sql`UPDATE account_data_settings set enabled = true WHERE account_id = ${result.after[0].account_id} AND account_data_type_id = ${result.after[0].account_data_type_id};`;
    const afterUpdate = await sql<
      AccountDataTypeRow[]
    >`SELECT * FROM account_data_settings WHERE account_id = ${result.after[0].account_id} AND account_data_type_id = ${result.after[0].account_data_type_id}`;
    const updatedAtAfterUpdate = new Date(afterUpdate[0].updated_at);
    const createdAtAfterUpdate = new Date(afterUpdate[0].created_at);

    expect(createdAtAfterUpdate).toStrictEqual(createdAt);
    expect(updatedAtAfterUpdate.getTime()).toBeGreaterThan(createdAt.getTime());
  });
});
