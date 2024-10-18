import { TestDbFactory } from '@/__tests__/db.factory';
import { PostgresDatabaseMigrator } from '@/datasources/db/postgres-database.migrator';
import { faker } from '@faker-js/faker';
import type postgres from 'postgres';
import type { Sql } from 'postgres';

describe('Migration 00008_targeted_messaging_add_outreach_1', () => {
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
    await sql`DROP TABLE IF EXISTS outreaches, targeted_safes, submissions CASCADE;`;

    const result = await migrator.test({
      migration: '00008_targeted_messaging_add_outreach_1',
      after: async (sql: Sql) => {
        return {
          outreaches: {
            rows: await sql`SELECT * FROM outreaches`,
          },
        };
      },
    });

    expect(result.after).toStrictEqual({
      outreaches: {
        rows: [
          {
            id: expect.any(Number),
            source_id: 1,
            name: '',
            start_date: new Date('1970-01-01'),
            end_date: new Date('1970-01-01'),
            type: '',
            team_name: '',
            source_file: 'cluster_5_campaign.json',
            source_file_checksum:
              '443bf977e13c19788cd8e677e7efa73e2820d8c2bb68377a6ae1644e69486115',
            source_file_processed_date: null,
            created_at: expect.any(Date),
            updated_at: expect.any(Date),
          },
        ],
      },
    });
  });
});
