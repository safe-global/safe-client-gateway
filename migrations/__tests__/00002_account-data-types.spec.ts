import { dbFactory } from '@/__tests__/db.factory';
import { PostgresDatabaseMigrator } from '@/datasources/db/postgres-database.migrator';
import { Sql } from 'postgres';

interface AccountDataTypeRow {
  id: number;
  created_at: Date;
  updated_at: Date;
  name: string;
  description: string;
  is_active: boolean;
}

describe('Migration 00002_account-data-types', () => {
  const sql = dbFactory();
  const migrator = new PostgresDatabaseMigrator(sql);

  afterAll(async () => {
    await sql.end();
  });

  it('runs successfully', async () => {
    await sql`DROP TABLE IF EXISTS account_data_types CASCADE;`;

    const result = await migrator.test({
      migration: '00002_account-data-types',
      after: async (sql: Sql) => {
        return {
          account_data_types: {
            columns:
              await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'account_data_types'`,
            rows: await sql`SELECT * FROM account_data_types`,
          },
        };
      },
    });

    expect(result.after).toStrictEqual({
      account_data_types: {
        columns: expect.arrayContaining([
          { column_name: 'id' },
          { column_name: 'created_at' },
          { column_name: 'updated_at' },
          { column_name: 'name' },
          { column_name: 'description' },
          { column_name: 'is_active' },
        ]),
        rows: [
          {
            created_at: expect.any(Date),
            description: 'Counterfactual Safes',
            id: expect.any(Number),
            is_active: true,
            name: 'CounterfactualSafes',
            updated_at: expect.any(Date),
          },
          {
            created_at: expect.any(Date),
            description: 'Address Book',
            id: expect.any(Number),
            is_active: false,
            name: 'AddressBook',
            updated_at: expect.any(Date),
          },
          {
            created_at: expect.any(Date),
            description: 'Watchlist',
            id: expect.any(Number),
            is_active: false,
            name: 'Watchlist',
            updated_at: expect.any(Date),
          },
        ],
      },
    });
  });

  it('should add and update row timestamps', async () => {
    await sql`DROP TABLE IF EXISTS account_data_types CASCADE;`;

    const result: { before: unknown; after: AccountDataTypeRow[] } =
      await migrator.test({
        migration: '00002_account-data-types',
        after: async (sql: Sql): Promise<AccountDataTypeRow[]> => {
          await sql`INSERT INTO account_data_types (name) VALUES ('accountDataTypeTestName');`;
          return await sql<
            AccountDataTypeRow[]
          >`SELECT * FROM account_data_types`;
        },
      });

    expect(result.after[3].name).toBe('accountDataTypeTestName');
    expect(result.after[3].description).toBeNull();
    expect(result.after[3].is_active).toBe(true);

    // created_at and updated_at should be the same after the row is created
    const createdAt = new Date(result.after[0].created_at);
    const updatedAt = new Date(result.after[0].updated_at);
    expect(createdAt).toBeInstanceOf(Date);
    expect(createdAt).toStrictEqual(updatedAt);

    // only updated_at should be updated after the row is updated
    await sql`UPDATE account_data_types set name = 'updatedName' WHERE id = 1;`;
    const afterUpdate = await sql<
      AccountDataTypeRow[]
    >`SELECT * FROM account_data_types WHERE id = 1`;
    const updatedAtAfterUpdate = new Date(afterUpdate[0].updated_at);
    const createdAtAfterUpdate = new Date(afterUpdate[0].created_at);

    expect(createdAtAfterUpdate).toStrictEqual(createdAt);
    expect(updatedAtAfterUpdate.getTime()).toBeGreaterThan(createdAt.getTime());
  });
});
