import { TestDbFactory } from '@/__tests__/db.factory';
import { waitMilliseconds } from '@/__tests__/util/retry';
import { PostgresDatabaseMigrator } from '@/datasources/db/v1/postgres-database.migrator';
import { faker } from '@faker-js/faker';
import type postgres from 'postgres';
import { getAddress } from 'viem';

interface AccountDataTypeRow {
  id: number;
  created_at: Date;
  updated_at: Date;
  name: string;
  description: string;
  is_active: boolean;
}

interface AccountRow {
  id: number;
  group_id: number;
  created_at: Date;
  updated_at: Date;
  address: `0x${string}`;
}

interface AddressBooksRow {
  id: number;
  account_id: number;
  chain_id: string;
  data: Buffer;
  key: Buffer;
  iv: Buffer;
  created_at: Date;
  updated_at: Date;
}

describe('Migration 00011_address-books', () => {
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
      migration: '00011_address-books',
      after: async (sql: postgres.Sql) => {
        return {
          address_books: {
            columns:
              await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'address_books'`,
            rows: await sql`SELECT * FROM account_data_settings`,
            indexes:
              await sql`SELECT indexname FROM pg_indexes WHERE tablename = 'address_books'`,
          },
        };
      },
    });

    expect(result.after).toStrictEqual({
      address_books: {
        columns: expect.arrayContaining([
          { column_name: 'id' },
          { column_name: 'account_id' },
          { column_name: 'chain_id' },
          { column_name: 'created_at' },
          { column_name: 'updated_at' },
          { column_name: 'data' },
          { column_name: 'key' },
          { column_name: 'iv' },
        ]),
        rows: [],
        indexes: expect.arrayContaining([
          {
            indexname: 'idx_address_books_account_id_chain_id',
          },
        ]),
      },
    });
  });

  it('should add one AddressBook and update its row timestamps', async () => {
    const accountAddress = getAddress(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric();
    let accountRows: AccountRow[] = [];
    let addressBooks: Partial<AddressBooksRow>[] = [];

    const { after: addressBookRows }: { after: AddressBooksRow[] } =
      await migrator.test({
        migration: '00011_address-books',
        after: async (sql: postgres.Sql): Promise<AddressBooksRow[]> => {
          accountRows = await sql<
            AccountRow[]
          >`INSERT INTO accounts (address, name, name_hash) VALUES (${accountAddress}, 'name', 'hash') RETURNING *;`;
          addressBooks = [
            {
              account_id: accountRows[0].id,
              chain_id: chainId,
              data: Buffer.from(faker.string.alphanumeric()),
              key: Buffer.from(faker.string.alphanumeric()),
              iv: Buffer.from(faker.string.alphanumeric()),
            },
          ];
          return sql<
            AddressBooksRow[]
          >`INSERT INTO address_books ${sql(addressBooks)} RETURNING *`;
        },
      });

    expect(addressBookRows[0]).toMatchObject({
      ...addressBooks[0],
      id: expect.any(Number),
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });
    // created_at and updated_at should be the same after the row is created
    const createdAt = new Date(addressBookRows[0].created_at);
    const updatedAt = new Date(addressBookRows[0].updated_at);
    expect(createdAt).toBeInstanceOf(Date);
    expect(createdAt).toStrictEqual(updatedAt);

    // wait for 1 millisecond to ensure that the updated_at timestamp is different
    await waitMilliseconds(1);
    // only updated_at should be updated after the row is updated
    const afterUpdate = await sql<AddressBooksRow[]>`UPDATE address_books
        SET data = ${Buffer.from(faker.string.alphanumeric())}
        WHERE account_id = ${accountRows[0].id} AND chain_id = ${chainId}
        RETURNING *;`;
    const updatedAtAfterUpdate = new Date(afterUpdate[0].updated_at);
    const createdAtAfterUpdate = new Date(afterUpdate[0].created_at);
    expect(createdAtAfterUpdate).toStrictEqual(createdAt);
    expect(updatedAtAfterUpdate.getTime()).toBeGreaterThan(createdAt.getTime());
  });

  it('should trigger a cascade delete when the referenced account is deleted', async () => {
    const accountAddress = getAddress(faker.finance.ethereumAddress());
    let accountRows: AccountRow[] = [];

    const { after: addressBooksRows }: { after: AddressBooksRow[] } =
      await migrator.test({
        migration: '00011_address-books',
        after: async (sql: postgres.Sql): Promise<AddressBooksRow[]> => {
          accountRows = await sql<
            AccountRow[]
          >`INSERT INTO accounts (address, name, name_hash) VALUES (${accountAddress}, 'name', 'hash') RETURNING *;`;
          await sql<AddressBooksRow[]>`INSERT INTO address_books ${sql([
            {
              account_id: accountRows[0].id,
              chain_id: faker.string.numeric(),
              data: Buffer.from(faker.string.alphanumeric()),
              key: Buffer.from(faker.string.alphanumeric()),
              iv: Buffer.from(faker.string.alphanumeric()),
            },
          ])}`;
          await sql`DELETE FROM accounts WHERE id = ${accountRows[0].id};`;
          return sql<
            AddressBooksRow[]
          >`SELECT * FROM address_books WHERE account_id = ${accountRows[0].id}`;
        },
      });

    expect(addressBooksRows).toHaveLength(0);
  });

  it('should throw an error if the unique(account_id, chain_id) constraint is violated', async () => {
    const accountAddress = getAddress(faker.finance.ethereumAddress());
    let accountRows: AccountRow[] = [];

    await migrator.test({
      migration: '00011_address-books',
      after: async (sql: postgres.Sql) => {
        accountRows = await sql<
          AccountRow[]
        >`INSERT INTO accounts (address, name, name_hash) VALUES (${accountAddress}, 'name', 'hash') RETURNING *;`;
        const duplicatedChainId = faker.string.numeric();
        const duplicatedAccountId = accountRows[0].id;
        await sql<AddressBooksRow[]>`INSERT INTO address_books ${sql([
          {
            account_id: duplicatedAccountId,
            chain_id: duplicatedChainId,
            data: Buffer.from(faker.string.alphanumeric()),
            key: Buffer.from(faker.string.alphanumeric()),
            iv: Buffer.from(faker.string.alphanumeric()),
          },
        ])}`;
        await expect(
          sql`INSERT INTO address_books ${sql([
            {
              account_id: duplicatedAccountId,
              chain_id: duplicatedChainId,
              data: Buffer.from(faker.string.alphanumeric()),
              key: Buffer.from(faker.string.alphanumeric()),
              iv: Buffer.from(faker.string.alphanumeric()),
            },
          ])}`,
        ).rejects.toThrow(
          'duplicate key value violates unique constraint "unique_account_id_chain_id"',
        );
      },
    });
  });

  it('should set the AddressBook DataType as active ', async () => {
    await migrator.test({
      migration: '00011_address-books',
      before: async (sql: postgres.Sql) => {
        const dataTypes = await sql<
          AccountDataTypeRow[]
        >`SELECT * FROM account_data_types WHERE name = 'AddressBook'`;
        expect(dataTypes).toHaveLength(1);
        expect(dataTypes[0].is_active).toBe(false);
      },
      after: async (sql: postgres.Sql) => {
        const dataTypes = await sql<
          AccountDataTypeRow[]
        >`SELECT * FROM account_data_types WHERE name = 'AddressBook'`;
        expect(dataTypes).toHaveLength(1);
        expect(dataTypes[0].is_active).toBe(true);
      },
    });
  });
});
