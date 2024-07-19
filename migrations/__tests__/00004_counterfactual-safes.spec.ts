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

interface CounterfactualSafesRow {
  created_at: Date;
  updated_at: Date;
  id: number;
  chain_id: string;
  creator:`0x${string}`;
  fallback_handler: `0x${string}`;
  owners: `0x${string}`[];
  predicted_address: `0x${string}`;
  salt_nonce: string;
  singleton_address: `0x${string}`;
  threshold: number;
  account_id: number;
}

describe('Migration 00004_counterfactual-safes', () => {
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
      migration: '00004_counterfactual-safes',
      after: async (sql: postgres.Sql) => {
        return {
          account_data_types: {
            columns:
              await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'counterfactual_safes'`,
            rows: await sql`SELECT * FROM account_data_settings`,
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
          { column_name: 'chain_id' },
          { column_name: 'creator' },
          { column_name: 'fallback_handler' },
          { column_name: 'owners' },
          { column_name: 'predicted_address' },
          { column_name: 'salt_nonce' },
          { column_name: 'singleton_address' },
          { column_name: 'threshold' },
          { column_name: 'account_id' },
        ]),
        rows: [],
      },
    });
  });

  it('should add one CounterfactualSafe and update its row timestamps', async () => {
    const accountAddress = getAddress(faker.finance.ethereumAddress());
    let accountRows: AccountRow[] = [];
    let counterfactualSafes: Partial<CounterfactualSafesRow>[] = [];

    const {
      after: counterfactualSafesRows,
    }: { after: CounterfactualSafesRow[] } = await migrator.test({
      migration: '00004_counterfactual-safes',
      after: async (sql: postgres.Sql): Promise<CounterfactualSafesRow[]> => {
        accountRows = await sql<
          AccountRow[]
        >`INSERT INTO accounts (address) VALUES (${accountAddress}) RETURNING *;`;
        counterfactualSafes = [
          {
            chain_id: faker.string.numeric(),
            creator: accountAddress,
            fallback_handler: getAddress(faker.finance.ethereumAddress()),
            owners: [
              getAddress(faker.finance.ethereumAddress()),
              getAddress(faker.finance.ethereumAddress()),
            ],
            predicted_address: getAddress(faker.finance.ethereumAddress()),
            salt_nonce: faker.string.numeric(),
            singleton_address: getAddress(faker.finance.ethereumAddress()),
            threshold: faker.number.int({ min: 1, max: 10 }),
            account_id: accountRows[0].id,
          },
        ];
        return sql<
          CounterfactualSafesRow[]
        >`INSERT INTO counterfactual_safes ${sql(counterfactualSafes)} RETURNING *`;
      },
    });

    expect(counterfactualSafesRows[0]).toMatchObject({
      chain_id: counterfactualSafes[0].chain_id,
      creator: counterfactualSafes[0].creator,
      fallback_handler: counterfactualSafes[0].fallback_handler,
      owners: counterfactualSafes[0].owners,
      predicted_address: counterfactualSafes[0].predicted_address,
      salt_nonce: counterfactualSafes[0].salt_nonce,
      singleton_address: counterfactualSafes[0].singleton_address,
      threshold: counterfactualSafes[0].threshold,
      account_id: accountRows[0].id,
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });
    // created_at and updated_at should be the same after the row is created
    const createdAt = new Date(counterfactualSafesRows[0].created_at);
    const updatedAt = new Date(counterfactualSafesRows[0].updated_at);
    expect(createdAt).toBeInstanceOf(Date);
    expect(createdAt).toStrictEqual(updatedAt);
    // only updated_at should be updated after the row is updated
    const afterUpdate = await sql<
      CounterfactualSafesRow[]
    >`UPDATE counterfactual_safes
        SET threshold = 4
        WHERE account_id = ${accountRows[0].id}
        RETURNING *;`;
    const updatedAtAfterUpdate = new Date(afterUpdate[0].updated_at);
    const createdAtAfterUpdate = new Date(afterUpdate[0].created_at);
    expect(createdAtAfterUpdate).toStrictEqual(createdAt);
    expect(updatedAtAfterUpdate.getTime()).toBeGreaterThan(createdAt.getTime());
  });

  it('should trigger a cascade delete when the referenced account is deleted', async () => {
    const accountAddress = getAddress(faker.finance.ethereumAddress());
    let accountRows: AccountRow[] = [];

    const {
      after: counterfactualSafesRows,
    }: { after: CounterfactualSafesRow[] } = await migrator.test({
      migration: '00004_counterfactual-safes',
      after: async (sql: postgres.Sql): Promise<CounterfactualSafesRow[]> => {
        accountRows = await sql<
          AccountRow[]
        >`INSERT INTO accounts (address) VALUES (${accountAddress}) RETURNING *;`;
        await sql<
          CounterfactualSafesRow[]
        >`INSERT INTO counterfactual_safes ${sql([
          {
            chain_id: faker.string.numeric(),
            creator: accountAddress,
            fallback_handler: getAddress(faker.finance.ethereumAddress()),
            owners: [
              getAddress(faker.finance.ethereumAddress()),
              getAddress(faker.finance.ethereumAddress()),
            ],
            predicted_address: getAddress(faker.finance.ethereumAddress()),
            salt_nonce: faker.string.numeric(),
            singleton_address: getAddress(faker.finance.ethereumAddress()),
            threshold: faker.number.int({ min: 1, max: 10 }),
            account_id: accountRows[0].id,
          },
        ])}`;
        await sql`DELETE FROM accounts WHERE id = ${accountRows[0].id};`;
        return sql<
          CounterfactualSafesRow[]
        >`SELECT * FROM counterfactual_safes WHERE account_id = ${accountRows[0].id}`;
      },
    });

    expect(counterfactualSafesRows).toHaveLength(0);
  });

  it('should throw an error if the unique(chain_id, predicted_address) constraint is violated', async () => {
    const accountAddress = getAddress(faker.finance.ethereumAddress());
    let accountRows: AccountRow[] = [];

    await migrator.test({
      migration: '00004_counterfactual-safes',
      after: async (sql: postgres.Sql) => {
        accountRows = await sql<
          AccountRow[]
        >`INSERT INTO accounts (address) VALUES (${accountAddress}) RETURNING *;`;
        const predicted_address = getAddress(faker.finance.ethereumAddress());
        const chain_id = faker.string.numeric();
        await sql<
          CounterfactualSafesRow[]
        >`INSERT INTO counterfactual_safes ${sql([
          {
            chain_id,
            creator: accountAddress,
            fallback_handler: getAddress(faker.finance.ethereumAddress()),
            owners: [
              getAddress(faker.finance.ethereumAddress()),
              getAddress(faker.finance.ethereumAddress()),
            ],
            predicted_address,
            salt_nonce: faker.string.numeric(),
            singleton_address: getAddress(faker.finance.ethereumAddress()),
            threshold: faker.number.int({ min: 1, max: 10 }),
            account_id: accountRows[0].id,
          },
        ])}`;
        await expect(
          sql`INSERT INTO counterfactual_safes ${sql([
            {
              chain_id,
              creator: accountAddress,
              fallback_handler: getAddress(faker.finance.ethereumAddress()),
              owners: [
                getAddress(faker.finance.ethereumAddress()),
                getAddress(faker.finance.ethereumAddress()),
              ],
              predicted_address,
              salt_nonce: faker.string.numeric(),
              singleton_address: getAddress(faker.finance.ethereumAddress()),
              threshold: faker.number.int({ min: 1, max: 10 }),
              account_id: accountRows[0].id,
            },
          ])}`,
        ).rejects.toThrow('duplicate key value violates unique constraint');
      },
    });
  });
});
