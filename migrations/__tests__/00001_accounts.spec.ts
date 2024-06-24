import { dbFactory } from '@/__tests__/db.factory';
import { PostgresDatabaseMigrator } from '@/datasources/db/postgres-database.migrator';
import { Sql } from 'postgres';

interface AccountRow {
  id: number;
  group_id: number;
  created_at: Date;
  updated_at: Date;
  address: `0x${string}`;
}

describe('Migration 00001_accounts', () => {
  const sql = dbFactory();
  const migrator = new PostgresDatabaseMigrator(sql);

  afterAll(async () => {
    await sql.end();
  });

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
          { column_name: 'created_at' },
          { column_name: 'updated_at' },
          { column_name: 'address' },
        ],
        rows: [],
      },
      groups: {
        columns: [
          { column_name: 'id' },
          { column_name: 'created_at' },
          { column_name: 'updated_at' },
        ],
        rows: [],
      },
    });
  });

  it('should add and update row timestamps', async () => {
    await sql`DROP TABLE IF EXISTS groups, accounts CASCADE;`;

    const result: {
      before: unknown;
      after: AccountRow[];
    } = await migrator.test({
      migration: '00001_accounts',
      after: async (sql: Sql): Promise<AccountRow[]> => {
        await sql`INSERT INTO groups (id) VALUES (1);`;
        await sql`INSERT INTO accounts (id, group_id, address) VALUES (1, 1, '0x0000');`;
        await sql`UPDATE accounts set address = '0x0001' WHERE id = 1;`;
        return await sql<AccountRow[]>`SELECT * FROM accounts`;
      },
    });

    const createdAt = new Date(result.after[0].created_at);
    const updatedAt = new Date(result.after[0].updated_at);

    expect(result.after).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          created_at: createdAt,
          updated_at: updatedAt,
        }),
      ]),
    );

    expect(updatedAt.getTime()).toBeGreaterThan(createdAt.getTime());
  });

  it('only updated_at should be updated on row changes', async () => {
    await sql`DROP TABLE IF EXISTS groups, accounts CASCADE;`;

    const result: {
      before: unknown;
      after: AccountRow[];
    } = await migrator.test({
      migration: '00001_accounts',
      after: async (sql: Sql): Promise<AccountRow[]> => {
        await sql`INSERT INTO groups (id) VALUES (1);`;
        await sql`INSERT INTO accounts (id, group_id, address) VALUES (1, 1, '0x0000');`;
        return await sql<AccountRow[]>`SELECT * FROM accounts`;
      },
    });

    // created_at and updated_at should be the same after the row is created
    const createdAt = new Date(result.after[0].created_at);
    const updatedAt = new Date(result.after[0].updated_at);
    expect(createdAt).toStrictEqual(updatedAt);

    // only updated_at should be updated after the row is updated
    await sql`UPDATE accounts set address = '0x0001' WHERE id = 1;`;
    const afterUpdate = await sql<AccountRow[]>`SELECT * FROM accounts`;
    const updatedAtAfterUpdate = new Date(afterUpdate[0].updated_at);
    const createdAtAfterUpdate = new Date(afterUpdate[0].created_at);

    expect(createdAtAfterUpdate).toStrictEqual(createdAt);
    expect(updatedAtAfterUpdate.getTime()).toBeGreaterThan(createdAt.getTime());
  });
});
