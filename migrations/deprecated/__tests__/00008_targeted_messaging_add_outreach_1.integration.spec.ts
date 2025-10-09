import { TestDbFactory } from '@/__tests__/db.factory';
import { PostgresDatabaseMigrator } from '@/datasources/db/v1/postgres-database.migrator';
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
              'ba79d7b59fc99d2c967a5bef772333bdfac8c146de02f10bbd20eb1735353a2b',
            source_file_processed_date: null,
            created_at: expect.any(Date),
            updated_at: expect.any(Date),
          },
        ],
      },
    });
  });
});
