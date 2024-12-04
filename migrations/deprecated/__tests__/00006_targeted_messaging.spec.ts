import { TestDbFactory } from '@/__tests__/db.factory';
import { waitMilliseconds } from '@/__tests__/util/retry';
import { PostgresDatabaseMigrator } from '@/datasources/db/v1/postgres-database.migrator';
import type { Outreach } from '@/domain/targeted-messaging/entities/outreach.entity';
import type { Submission } from '@/domain/targeted-messaging/entities/submission.entity';
import type { TargetedSafe } from '@/domain/targeted-messaging/entities/targeted-safe.entity';
import { faker } from '@faker-js/faker';
import type { Sql } from 'postgres';
import type postgres from 'postgres';

describe('Migration 00006_targeted_messaging', () => {
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
      migration: '00006_targeted_messaging',
      after: async (sql: Sql) => {
        return {
          outreaches: {
            columns:
              await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'outreaches'`,
            rows: await sql`SELECT * FROM outreaches`,
          },
          targeted_safes: {
            columns:
              await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'targeted_safes'`,
            rows: await sql`SELECT * FROM targeted_safes`,
          },
          submissions: {
            columns:
              await sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'submissions'`,
            rows: await sql`SELECT * FROM submissions`,
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
        ]),
        rows: [],
      },
      targeted_safes: {
        columns: expect.arrayContaining([
          { column_name: 'id' },
          { column_name: 'address' },
          { column_name: 'outreach_id' },
          { column_name: 'created_at' },
          { column_name: 'updated_at' },
        ]),
        rows: [],
      },
      submissions: {
        columns: expect.arrayContaining([
          { column_name: 'id' },
          { column_name: 'targeted_safe_id' },
          { column_name: 'signer_address' },
          { column_name: 'completion_date' },
        ]),
        rows: [],
      },
    });
  });

  describe('Outreaches', () => {
    it('should upsert the updated_at timestamp when updating an outreach', async () => {
      const result: {
        before: unknown;
        after: Outreach[];
      } = await migrator.test({
        migration: '00006_targeted_messaging',
        after: async (sql: Sql): Promise<Outreach[]> => {
          const startDate = faker.date.recent();
          const endDate = faker.date.future({ refDate: startDate });
          const [outreach] = await sql<[Outreach]>`
            INSERT INTO outreaches (name, start_date, end_date)
            VALUES (${faker.string.alphanumeric()}, ${startDate}, ${endDate})
            RETURNING *`;
          return [outreach];
        },
      });

      // created_at and updated_at should be the same after the row is created
      const createdAt = new Date(result.after[0].created_at);
      const updatedAt = new Date(result.after[0].updated_at);
      expect(createdAt).toStrictEqual(updatedAt);

      // wait for 1 millisecond to ensure that the updated_at timestamp is different
      await waitMilliseconds(1);
      // only updated_at should be updated after the row is updated
      await sql`UPDATE outreaches set name = ${faker.string.alphanumeric()} WHERE id = 1;`;
      const afterUpdate = await sql<Outreach[]>`SELECT * FROM outreaches`;
      const updatedAtAfterUpdate = new Date(afterUpdate[0].updated_at);
      const createdAtAfterUpdate = new Date(afterUpdate[0].created_at);

      expect(createdAtAfterUpdate).toStrictEqual(createdAt);
      expect(updatedAtAfterUpdate.getTime()).toBeGreaterThan(
        createdAt.getTime(),
      );
    });

    it('should throw an error if the unique(name) constraint is violated', async () => {
      await migrator.test({
        migration: '00006_targeted_messaging',
        after: async (sql: Sql) => {
          const [outreach] = await sql<[Outreach]>`
            INSERT INTO outreaches (name, start_date, end_date)
            VALUES (${faker.string.alphanumeric()}, ${faker.date.recent()}, ${faker.date.future()})
            RETURNING *`;
          await expect(
            sql<[Outreach]>`
            INSERT INTO outreaches (name, start_date, end_date)
            VALUES (${outreach.name}, ${faker.date.recent()}, ${faker.date.future()})
            RETURNING *`,
          ).rejects.toThrow('duplicate key value violates unique constraint');
        },
      });
    });
  });

  describe('TargetedSafes', () => {
    it('should upsert the updated_at timestamp when updating a targeted_safe', async () => {
      const result: {
        before: unknown;
        after: TargetedSafe[];
      } = await migrator.test({
        migration: '00006_targeted_messaging',
        after: async (sql: Sql): Promise<TargetedSafe[]> => {
          const startDate = faker.date.recent();
          const endDate = faker.date.future({ refDate: startDate });
          const [outreach] = await sql<[Outreach]>`
            INSERT INTO outreaches (name, start_date, end_date)
            VALUES (${faker.string.alphanumeric()}, ${startDate}, ${endDate})
            RETURNING *`;
          const [targetedSafe] = await sql<[TargetedSafe]>`
          INSERT INTO targeted_safes (address, outreach_id)
          VALUES (${faker.finance.ethereumAddress()}, ${outreach.id})
          RETURNING *`;
          return [targetedSafe];
        },
      });

      // created_at and updated_at should be the same after the row is created
      const createdAt = new Date(result.after[0].created_at);
      const updatedAt = new Date(result.after[0].updated_at);
      expect(createdAt).toStrictEqual(updatedAt);

      // wait for 1 millisecond to ensure that the updated_at timestamp is different
      await waitMilliseconds(1);
      // only updated_at should be updated after the row is updated
      await sql`UPDATE targeted_safes set address = ${faker.finance.ethereumAddress()} WHERE id = 1;`;
      const afterUpdate = await sql<
        TargetedSafe[]
      >`SELECT * FROM targeted_safes`;
      const updatedAtAfterUpdate = new Date(afterUpdate[0].updated_at);
      const createdAtAfterUpdate = new Date(afterUpdate[0].created_at);

      expect(createdAtAfterUpdate).toStrictEqual(createdAt);
      expect(updatedAtAfterUpdate.getTime()).toBeGreaterThan(
        createdAt.getTime(),
      );
    });

    it('should throw an error if the unique(address, outreach_id) constraint is violated', async () => {
      await migrator.test({
        migration: '00006_targeted_messaging',
        after: async (sql: Sql) => {
          const startDate = faker.date.recent();
          const endDate = faker.date.future({ refDate: startDate });
          const [outreach] = await sql<[Outreach]>`
            INSERT INTO outreaches (name, start_date, end_date)
            VALUES (${faker.string.alphanumeric()}, ${startDate}, ${endDate})
            RETURNING *`;
          const [targetedSafe] = await sql<[TargetedSafe]>`
            INSERT INTO targeted_safes (address, outreach_id)
            VALUES (${faker.finance.ethereumAddress()}, ${outreach.id})
            RETURNING *`;
          await expect(
            sql<[TargetedSafe]>`
            INSERT INTO targeted_safes (address, outreach_id)
            VALUES (${targetedSafe.address}, ${outreach.id})
            RETURNING *`,
          ).rejects.toThrow('duplicate key value violates unique constraint');
        },
      });
    });
  });

  describe('Submissions', () => {
    it('should upsert the updated_at timestamp when updating a submission', async () => {
      const result: {
        before: unknown;
        after: Submission[];
      } = await migrator.test({
        migration: '00006_targeted_messaging',
        after: async (sql: Sql): Promise<Submission[]> => {
          const startDate = faker.date.recent();
          const endDate = faker.date.future({ refDate: startDate });
          const [outreach] = await sql<[Outreach]>`
            INSERT INTO outreaches (name, start_date, end_date)
            VALUES (${faker.string.alphanumeric()}, ${startDate}, ${endDate})
            RETURNING *`;
          const [targetedSafe] = await sql<[TargetedSafe]>`
            INSERT INTO targeted_safes (address, outreach_id)
            VALUES (${faker.finance.ethereumAddress()}, ${outreach.id})
            RETURNING *`;
          const [submission] = await sql<[Submission]>`
            INSERT INTO submissions (targeted_safe_id, signer_address, completion_date)
            VALUES (${targetedSafe.id}, ${faker.finance.ethereumAddress()}, ${faker.date.recent()})
            RETURNING *`;
          return [submission];
        },
      });

      // created_at and updated_at should be the same after the row is created
      const createdAt = new Date(result.after[0].created_at);
      const updatedAt = new Date(result.after[0].updated_at);
      expect(createdAt).toStrictEqual(updatedAt);

      // wait for 1 millisecond to ensure that the updated_at timestamp is different
      await waitMilliseconds(1);
      // only updated_at should be updated after the row is updated
      await sql`UPDATE submissions set completion_date = ${new Date()} WHERE id = 1;`;
      const afterUpdate = await sql<Submission[]>`SELECT * FROM submissions`;
      const updatedAtAfterUpdate = new Date(afterUpdate[0].updated_at);
      const createdAtAfterUpdate = new Date(afterUpdate[0].created_at);

      expect(createdAtAfterUpdate).toStrictEqual(createdAt);
      expect(updatedAtAfterUpdate.getTime()).toBeGreaterThan(
        createdAt.getTime(),
      );
    });

    it('should trigger a cascade delete when the referenced target_safe is deleted', async () => {
      const result: {
        before: unknown;
        after: Submission[];
      } = await migrator.test({
        migration: '00006_targeted_messaging',
        after: async (sql: Sql): Promise<Submission[]> => {
          const startDate = faker.date.recent();
          const endDate = faker.date.future({ refDate: startDate });
          const [outreach] = await sql<[Outreach]>`
            INSERT INTO outreaches (name, start_date, end_date)
            VALUES (${faker.string.alphanumeric()}, ${startDate}, ${endDate})
            RETURNING *`;
          const [targetedSafe] = await sql<[TargetedSafe]>`
            INSERT INTO targeted_safes (address, outreach_id)
            VALUES (${faker.finance.ethereumAddress()}, ${outreach.id})
            RETURNING *`;
          await sql<[Submission]>`
            INSERT INTO submissions (targeted_safe_id, signer_address, completion_date)
            VALUES (${targetedSafe.id}, ${faker.finance.ethereumAddress()}, ${faker.date.recent()})
            RETURNING *`;
          await sql`DELETE FROM targeted_safes WHERE id = ${targetedSafe.id};`;
          return await sql<Submission[]>`SELECT * FROM submissions`;
        },
      });

      expect(result.after).toStrictEqual([]);
    });

    it('should throw an error if the unique(targeted_safe_id, signer_address) constraint is violated', async () => {
      await migrator.test({
        migration: '00006_targeted_messaging',
        after: async (sql: Sql) => {
          const startDate = faker.date.recent();
          const endDate = faker.date.future({ refDate: startDate });
          const [outreach] = await sql<[Outreach]>`
            INSERT INTO outreaches (name, start_date, end_date)
            VALUES (${faker.string.alphanumeric()}, ${startDate}, ${endDate})
            RETURNING *`;
          const [targetedSafe] = await sql<[TargetedSafe]>`
            INSERT INTO targeted_safes (address, outreach_id)
            VALUES (${faker.finance.ethereumAddress()}, ${outreach.id})
            RETURNING *`;
          const signerAddress = faker.finance.ethereumAddress();
          await sql<[Submission]>`
          INSERT INTO submissions (targeted_safe_id, signer_address, completion_date)
          VALUES (${targetedSafe.id}, ${signerAddress}, ${faker.date.recent()})
            RETURNING *`;
          await expect(
            sql<[Submission]>`
            INSERT INTO submissions (targeted_safe_id, signer_address, completion_date)
            VALUES (${targetedSafe.id}, ${signerAddress}, ${faker.date.recent()})
            RETURNING *`,
          ).rejects.toThrow('duplicate key value violates unique constraint');
        },
      });
    });
  });
});
