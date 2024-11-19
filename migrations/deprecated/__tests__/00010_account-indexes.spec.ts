import { TestDbFactory } from '@/__tests__/db.factory';
import { PostgresDatabaseMigrator } from '@/datasources/db/v1/postgres-database.migrator';
import { faker } from '@faker-js/faker/.';
import type postgres from 'postgres';

describe('Migration 00010_account-indexes', () => {
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
      migration: '00010_account-indexes',
      after: async (sql: postgres.Sql) => {
        return {
          accounts: {
            indexes:
              await sql`SELECT indexname FROM pg_indexes WHERE tablename = 'accounts'`,
          },
          account_data_settings: {
            indexes:
              await sql`SELECT indexname FROM pg_indexes WHERE tablename = 'account_data_settings'`,
          },
          counterfactual_safes: {
            indexes:
              await sql`SELECT indexname FROM pg_indexes WHERE tablename = 'counterfactual_safes'`,
          },
          targeted_safes: {
            indexes:
              await sql`SELECT indexname FROM pg_indexes WHERE tablename = 'targeted_safes'`,
          },
          submissions: {
            indexes:
              await sql`SELECT indexname FROM pg_indexes WHERE tablename = 'submissions'`,
          },
        };
      },
    });

    expect(result.after).toMatchObject({
      accounts: {
        indexes: expect.arrayContaining([
          { indexname: 'idx_accounts_group_id' },
        ]),
      },
      account_data_settings: {
        indexes: expect.arrayContaining([
          {
            indexname:
              'idx_account_data_settings_account_id_account_data_type_id',
          },
        ]),
      },
      counterfactual_safes: {
        indexes: expect.arrayContaining([
          {
            indexname: 'idx_counterfactual_safes_account_id',
          },
          {
            indexname:
              'idx_counterfactual_safes_account_id_chain_id_predicted_address',
          },
        ]),
      },
      targeted_safes: {
        indexes: expect.arrayContaining([
          {
            indexname: 'idx_targeted_safes_outreach_id_address',
          },
        ]),
      },
      submissions: {
        indexes: expect.arrayContaining([
          {
            indexname: 'idx_submissions_targeted_safe_id_signer_address',
          },
        ]),
      },
    });
  });
});
