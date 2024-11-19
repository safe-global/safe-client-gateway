import { TestDbFactory } from '@/__tests__/db.factory';
import { PostgresDatabaseMigrator } from '@/datasources/db/v1/postgres-database.migrator';
import { faker } from '@faker-js/faker';
import type postgres from 'postgres';

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
      migration: '00009_account-names',
      after: async (sql: postgres.Sql) => {
        return {
          accounts: {
            columns:
              await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'accounts'`,
            nonNullColumns:
              await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'accounts' AND IS_NULLABLE = 'NO';`,
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
        nonNullColumns: expect.arrayContaining([
          { column_name: 'id' },
          { column_name: 'address' },
          { column_name: 'name' },
          { column_name: 'name_hash' },
        ]),
        rows: [],
        uniqueConstraints: expect.arrayContaining([
          { constraint_name: 'accounts_address_key' },
          { constraint_name: 'name_hash_unique' },
        ]),
      },
    });
  });

  it('sets a random name/name_hash for existing accounts', async () => {
    const result = await migrator.test({
      migration: '00009_account-names',
      before: async (sql: postgres.Sql) => {
        await sql`INSERT INTO groups (id) VALUES (1);`;
        await sql`
          INSERT INTO accounts (group_id, address)
          VALUES (1, '0x001'), (1, '0x002')`;
      },
      after: async (sql: postgres.Sql) => {
        return {
          accounts: {
            rows: await sql`SELECT * FROM accounts`,
          },
        };
      },
    });

    expect(result.after).toMatchObject({
      accounts: {
        rows: expect.arrayContaining([
          expect.objectContaining({
            address: '0x001',
            name: expect.any(Object),
            name_hash: expect.any(String),
          }),
          expect.objectContaining({
            address: '0x002',
            name: expect.any(Object),
            name_hash: expect.any(String),
          }),
        ]),
      },
    });
  });

  it('should fail if name_hash is not unique', async () => {
    await migrator.test({
      migration: '00009_account-names',
      before: async (sql: postgres.Sql) => {
        await sql`INSERT INTO groups (id) VALUES (1);`;
      },
      after: async (sql: postgres.Sql) => {
        await sql`
          INSERT INTO accounts (group_id, address, name, name_hash)
          VALUES
            (1, '0x001', 'name', 'hash'),
            (1, '0x002', 'name', 'hash')`.catch((error) => {
          expect(error.message).toEqual(
            expect.stringContaining('name_hash_unique'),
          );
        });
      },
    });
  });
});
