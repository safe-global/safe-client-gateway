import { TestDbFactory } from '@/__tests__/db.factory';
import { PostgresDatabaseMigrator } from '@/datasources/db/v1/postgres-database.migrator';
import type { Outreach } from '@/modules/targeted-messaging/domain/entities/outreach.entity';
import { faker } from '@faker-js/faker';
import type postgres from 'postgres';
import type { Sql } from 'postgres';

describe('Migration 00014_targeted_messaging_add_chain_id', () => {
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

  it('runs successfully and adds chain_id column', async () => {
    const result = await migrator.test({
      migration: '00014_targeted_messaging_add_chain_id',
      after: async (sql: Sql) => {
        return {
          columns:
            await sql`SELECT COLUMN_NAME, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
                      FROM INFORMATION_SCHEMA.COLUMNS
                      WHERE TABLE_NAME = 'targeted_safes'
                      AND COLUMN_NAME = 'chain_id'`,
        };
      },
    });

    expect(result.after).toStrictEqual({
      columns: [
        {
          column_name: 'chain_id',
          is_nullable: 'YES',
          character_maximum_length: 32,
        },
      ],
    });
  });

  it('is backward compatible with existing data', async () => {
    const result = await migrator.test({
      migration: '00014_targeted_messaging_add_chain_id',
      before: async (sql: Sql) => {
        // Insert data before the migration (without chain_id column)
        const [outreach] = await sql<[Outreach]>`
          INSERT INTO outreaches (name, start_date, end_date, source_id, type, team_name)
          VALUES (${faker.string.alphanumeric(10)}, ${faker.date.recent()}, ${faker.date.future()}, ${faker.number.int({ min: 1000, max: 9999 })}, ${faker.string.alphanumeric(10)}, ${faker.string.alphanumeric(10)})
          RETURNING id`;

        const address1 = faker.finance.ethereumAddress();
        const address2 = faker.finance.ethereumAddress();

        await sql`
          INSERT INTO targeted_safes (address, outreach_id)
          VALUES (${address1}, ${outreach.id})`;

        await sql`
          INSERT INTO targeted_safes (address, outreach_id)
          VALUES (${address2}, ${outreach.id})`;

        return { address1, address2, outreachId: outreach.id };
      },
      after: async (sql: Sql) => {
        // Verify existing data has NULL chain_id after migration
        const rows = await sql`
          SELECT address, outreach_id, chain_id
          FROM targeted_safes
          ORDER BY address`;

        return { rows };
      },
    });

    expect(result.before).toBeDefined();
    expect(result.after.rows).toHaveLength(2);
    expect(result.after.rows[0]).toMatchObject({
      address: expect.any(String),
      outreach_id: result.before!.outreachId,
      chain_id: null,
    });
    expect(result.after.rows[1]).toMatchObject({
      address: expect.any(String),
      outreach_id: result.before!.outreachId,
      chain_id: null,
    });
  });

  describe('Unique constraints with chain_id', () => {
    it('should allow duplicate address+outreach_id when chain_id differs', async () => {
      await migrator.test({
        migration: '00014_targeted_messaging_add_chain_id',
        after: async (sql: Sql) => {
          const [outreach] = await sql<[Outreach]>`
            INSERT INTO outreaches (name, start_date, end_date, source_id, type, team_name)
            VALUES (${faker.string.alphanumeric(10)}, ${faker.date.recent()}, ${faker.date.future()}, ${faker.number.int({ min: 1000, max: 9999 })}, ${faker.string.alphanumeric(10)}, ${faker.string.alphanumeric(10)})
            RETURNING id`;

          const address = faker.finance.ethereumAddress();

          await sql`
            INSERT INTO targeted_safes (address, outreach_id, chain_id)
            VALUES (${address}, ${outreach.id}, '1')`;

          const [result] = await sql`
            INSERT INTO targeted_safes (address, outreach_id, chain_id)
            VALUES (${address}, ${outreach.id}, '10')
            RETURNING *`;

          expect(result.address).toBe(address);
          expect(result.chain_id).toBe('10');
        },
      });
    });

    it('should prevent duplicate address+outreach_id+chain_id', async () => {
      await migrator.test({
        migration: '00014_targeted_messaging_add_chain_id',
        after: async (sql: Sql) => {
          const [outreach] = await sql<[Outreach]>`
            INSERT INTO outreaches (name, start_date, end_date, source_id, type, team_name)
            VALUES (${faker.string.alphanumeric(10)}, ${faker.date.recent()}, ${faker.date.future()}, ${faker.number.int({ min: 1000, max: 9999 })}, ${faker.string.alphanumeric(10)}, ${faker.string.alphanumeric(10)})
            RETURNING id`;

          const address = faker.finance.ethereumAddress();

          await sql`
            INSERT INTO targeted_safes (address, outreach_id, chain_id)
            VALUES (${address}, ${outreach.id}, '1')`;

          await expect(
            sql`
              INSERT INTO targeted_safes (address, outreach_id, chain_id)
              VALUES (${address}, ${outreach.id}, '1')`,
          ).rejects.toThrow('duplicate key value');
        },
      });
    });

    it('should allow same address with different outreach_id when chain_id is NULL', async () => {
      await migrator.test({
        migration: '00014_targeted_messaging_add_chain_id',
        after: async (sql: Sql) => {
          const [outreach1] = await sql<[Outreach]>`
            INSERT INTO outreaches (name, start_date, end_date, source_id, type, team_name)
            VALUES (${faker.string.alphanumeric(10)}, ${faker.date.recent()}, ${faker.date.future()}, ${faker.number.int({ min: 1000, max: 9999 })}, ${faker.string.alphanumeric(10)}, ${faker.string.alphanumeric(10)})
            RETURNING id`;

          const [outreach2] = await sql<[Outreach]>`
            INSERT INTO outreaches (name, start_date, end_date, source_id, type, team_name)
            VALUES (${faker.string.alphanumeric(10)}, ${faker.date.recent()}, ${faker.date.future()}, ${faker.number.int({ min: 1000, max: 9999 })}, ${faker.string.alphanumeric(10)}, ${faker.string.alphanumeric(10)})
            RETURNING id`;

          const address = faker.finance.ethereumAddress();

          await sql`
            INSERT INTO targeted_safes (address, outreach_id, chain_id)
            VALUES (${address}, ${outreach1.id}, NULL)`;

          const [result] = await sql`
            INSERT INTO targeted_safes (address, outreach_id, chain_id)
            VALUES (${address}, ${outreach2.id}, NULL)
            RETURNING *`;

          expect(result.address).toBe(address);
          expect(result.chain_id).toBeNull();
        },
      });
    });

    it('should prevent duplicate address+outreach_id when both have NULL chain_id', async () => {
      await migrator.test({
        migration: '00014_targeted_messaging_add_chain_id',
        after: async (sql: Sql) => {
          const [outreach] = await sql<[Outreach]>`
            INSERT INTO outreaches (name, start_date, end_date, source_id, type, team_name)
            VALUES (${faker.string.alphanumeric(10)}, ${faker.date.recent()}, ${faker.date.future()}, ${faker.number.int({ min: 1000, max: 9999 })}, ${faker.string.alphanumeric(10)}, ${faker.string.alphanumeric(10)})
            RETURNING id`;

          const address = faker.finance.ethereumAddress();

          await sql`
            INSERT INTO targeted_safes (address, outreach_id, chain_id)
            VALUES (${address}, ${outreach.id}, NULL)`;

          await expect(
            sql`
              INSERT INTO targeted_safes (address, outreach_id, chain_id)
              VALUES (${address}, ${outreach.id}, NULL)`,
          ).rejects.toThrow('duplicate key value');
        },
      });
    });

    it('should prevent having both NULL and specific chain_id for same address+outreach', async () => {
      await migrator.test({
        migration: '00014_targeted_messaging_add_chain_id',
        after: async (sql: Sql) => {
          const [outreach] = await sql<[Outreach]>`
            INSERT INTO outreaches (name, start_date, end_date, source_id, type, team_name)
            VALUES (${faker.string.alphanumeric(10)}, ${faker.date.recent()}, ${faker.date.future()}, ${faker.number.int({ min: 1000, max: 9999 })}, ${faker.string.alphanumeric(10)}, ${faker.string.alphanumeric(10)})
            RETURNING id`;

          const address = faker.finance.ethereumAddress();

          // Insert with NULL chain_id first
          await sql`
            INSERT INTO targeted_safes (address, outreach_id, chain_id)
            VALUES (${address}, ${outreach.id}, NULL)`;

          // Try to insert with specific chain_id - should fail
          await expect(
            sql`
              INSERT INTO targeted_safes (address, outreach_id, chain_id)
              VALUES (${address}, ${outreach.id}, '1')`,
          ).rejects.toThrow(/exclusion constraint/);
        },
      });
    });

    it('should prevent having both specific chain_id and NULL for same address+outreach (reverse order)', async () => {
      await migrator.test({
        migration: '00014_targeted_messaging_add_chain_id',
        after: async (sql: Sql) => {
          const [outreach] = await sql<[Outreach]>`
            INSERT INTO outreaches (name, start_date, end_date, source_id, type, team_name)
            VALUES (${faker.string.alphanumeric(10)}, ${faker.date.recent()}, ${faker.date.future()}, ${faker.number.int({ min: 1000, max: 9999 })}, ${faker.string.alphanumeric(10)}, ${faker.string.alphanumeric(10)})
            RETURNING id`;

          const address = faker.finance.ethereumAddress();

          // Insert with specific chain_id first
          await sql`
            INSERT INTO targeted_safes (address, outreach_id, chain_id)
            VALUES (${address}, ${outreach.id}, '1')`;

          // Try to insert with NULL chain_id - should fail
          await expect(
            sql`
              INSERT INTO targeted_safes (address, outreach_id, chain_id)
              VALUES (${address}, ${outreach.id}, NULL)`,
          ).rejects.toThrow(/exclusion constraint/);
        },
      });
    });
  });
});
