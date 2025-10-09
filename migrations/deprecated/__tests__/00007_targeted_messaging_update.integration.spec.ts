import { TestDbFactory } from '@/__tests__/db.factory';
import { PostgresDatabaseMigrator } from '@/datasources/db/v1/postgres-database.migrator';
import type { Outreach } from '@/datasources/targeted-messaging/entities/outreach.entity';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { faker } from '@faker-js/faker';
import type postgres from 'postgres';
import type { Sql } from 'postgres';

describe('Migration 00007_targeted_messaging_update', () => {
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
      migration: '00007_targeted_messaging_update',
      after: async (sql: Sql) => {
        return {
          outreaches: {
            columns:
              await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'outreaches'`,
            rows: await sql`SELECT * FROM outreaches`,
          },
        };
      },
    });

    expect(result.after).toStrictEqual({
      outreaches: {
        columns: expect.arrayContaining([
          { column_name: 'id' },
          { column_name: 'name' },
          { column_name: 'start_date' },
          { column_name: 'end_date' },
          { column_name: 'source_id' },
          { column_name: 'type' },
          { column_name: 'team_name' },
          { column_name: 'source_file' },
          { column_name: 'source_file_processed_date' },
          { column_name: 'source_file_checksum' },
        ]),
        rows: [],
      },
    });
  });

  describe('Outreaches update', () => {
    it('should throw an error if the unique(source_id) constraint is violated', async () => {
      await migrator.test({
        migration: '00007_targeted_messaging_update',
        after: async (sql: Sql) => {
          const [outreach] = await sql<[Outreach]>`
            INSERT INTO outreaches (name, start_date, end_date, source_id, type, team_name, source_file)
            VALUES (
              ${faker.string.alphanumeric({ length: 10 })}, 
              ${faker.date.recent()}, ${faker.date.future()}, 
              ${faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER })},
              ${faker.string.alphanumeric({ length: 10 })},
              ${faker.string.alphanumeric({ length: 10 })},
              ${faker.string.alphanumeric({ length: 10 })})
            RETURNING *`;
          await expect(
            sql<[Outreach]>`
            INSERT INTO outreaches (name, start_date, end_date, source_id, type, team_name)
            VALUES (
            ${faker.string.alphanumeric({ length: 10 })},
            ${faker.date.recent()},
            ${faker.date.future()},
            ${outreach.source_id},
            ${faker.string.alphanumeric({ length: 10 })},
            ${faker.string.alphanumeric({ length: 10 })})
            `,
          ).rejects.toThrow('duplicate key value violates unique constraint');
        },
      });
    });

    it('should default to null for source_file, source_file_processed_date, and source_file_checksum', async () => {
      await migrator.test({
        migration: '00007_targeted_messaging_update',
        after: async (sql: Sql) => {
          const [outreach] = await sql<[Outreach]>`
            INSERT INTO outreaches (name, start_date, end_date, source_id, type, team_name)
            VALUES (
              ${faker.string.alphanumeric({ length: 10 })}, 
              ${faker.date.recent()}, ${faker.date.future()}, 
              ${faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER })},
              ${faker.string.alphanumeric({ length: 10 })},
              ${faker.string.alphanumeric({ length: 10 })})
            RETURNING *`;
          expect(outreach.source_file).toBeNull();
          expect(outreach.source_file_processed_date).toBeNull();
          expect(outreach.source_file_checksum).toBeNull();
        },
      });
    });
  });
});
