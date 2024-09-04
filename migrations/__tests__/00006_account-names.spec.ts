import { TestDbFactory } from '@/__tests__/db.factory';
import { PostgresDatabaseMigrator } from '@/datasources/db/postgres-database.migrator';
import { faker } from '@faker-js/faker';
import postgres from 'postgres';

describe('Migration 00006_accounts-names', () => {
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
      migration: '00006_account-names',
      after: async (sql: postgres.Sql) => {
        return {
          accounts: {
            columns:
              await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'accounts'`,
            rows: await sql`SELECT * FROM accounts`,
            uniqueConstraints: await sql`
                SELECT CONSTRAINT_NAME
                FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                WHERE TABLE_NAME = 'accounts' AND CONSTRAINT_TYPE = 'UNIQUE'`,
          },
        };
      },
    });

    expect(result.after).toMatchObject({
      accounts: {
        columns: expect.arrayContaining([
          { column_name: 'id' },
          { column_name: 'group_id' },
          { column_name: 'address' },
          { column_name: 'name' },
          { column_name: 'name_hash' },
          { column_name: 'created_at' },
          { column_name: 'updated_at' },
        ]),
        rows: [],
        uniqueConstraints: expect.arrayContaining([
          { constraint_name: 'accounts_address_key' },
          { constraint_name: 'name_hash_unique' },
        ]),
      },
    });
  });
});
