import { dbFactory } from '@/__tests__/db.factory';
import { PostgresDatabaseMigrator } from '@/datasources/db/postgres-database.migrator';
import { Sql } from 'postgres';

describe('Migration 00001_accounts', () => {
  const sql = dbFactory();
  const migrator = new PostgresDatabaseMigrator(sql);

  it('runs successfully', async () => {
    await sql`DROP TABLE IF EXISTS groups, accounts CASCADE;`;

    const cb = async (sql: Sql) => {
      const accounts = await sql`SELECT * FROM accounts`.catch(() => undefined);
      const groups = await sql`SELECT * FROM groups`.catch(() => undefined);

      return { accounts, groups };
    };

    const result = await migrator.test({
      migration: '00001_accounts',
      before: cb,
      after: cb,
    });

    expect(result.before).toStrictEqual({
      accounts: undefined,
      groups: undefined,
    });

    expect(result.after).toStrictEqual({
      accounts: [],
      groups: [],
    });

    await sql.end();
  });
});
