import { dbFactory } from '@/__tests__/db.factory';
import { PostgresDatabaseMigrator } from '@/datasources/db/postgres-database.migrator';
import { Sql } from 'postgres';

describe('Migration 00001_accounts', () => {
  const sql = dbFactory();
  const migrator = new PostgresDatabaseMigrator(sql);

  it('runs successfully', async () => {
    await sql`DROP TABLE IF EXISTS groups, accounts CASCADE;`;

    const result = await migrator.test({
      migration: '00001_accounts',
      after: async (sql: Sql) => {
        return {
          accounts: {
            columns:
              await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'accounts'`,
            rows: await sql`SELECT * FROM accounts`,
          },
          groups: {
            columns:
              await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'groups'`,
            rows: await sql`SELECT * FROM groups`,
          },
        };
      },
    });

    expect(result.after).toStrictEqual({
      accounts: {
        columns: [
          { column_name: 'id' },
          { column_name: 'group_id' },
          { column_name: 'address' },
        ],
        rows: [],
      },
      groups: {
        columns: [
          {
            column_name: 'id',
          },
        ],
        rows: [],
      },
    });

    await sql.end();
  });
});
