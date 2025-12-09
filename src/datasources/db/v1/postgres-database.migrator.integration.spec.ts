import { TestDbFactory } from '@/__tests__/db.factory';
import { PostgresDatabaseMigrator } from '@/datasources/db/v1/postgres-database.migrator';
import { faker } from '@faker-js/faker';
import fs from 'node:fs';
import path from 'node:path';
import type postgres from 'postgres';

const folder = path.join(__dirname, 'migrations');
const migrations: Array<{
  name: string;
  file: { name: string; contents: string };
}> = [
  {
    name: '00001_initial',
    file: {
      name: 'index.sql',
      contents: `drop table if exists test;
                 create table test (
                   a text,
                   b int
                 );

                 insert into test (a, b) values ('hello', 1337);`,
    },
  },
  {
    name: '00002_update',
    file: {
      name: 'index.js',
      contents: `module.exports = async function(sql) {
                  await sql\`
                    alter table test add column c timestamp with time zone
                  \`

                  await sql\`
                    insert into test (a, b, c) values ('world', 69420, ${'${new Date()}'})
                  \`
                }`,
    },
  },
  {
    name: '00003_delete',
    file: {
      name: 'index.sql',
      contents: 'drop table test;',
    },
  },
];
type TestRow = { a: string; b: number };
type ExtendedTestRow = { a: string; b: number; c: Date };

describe('PostgresDatabaseMigrator tests', () => {
  let sql: postgres.Sql;
  let target: PostgresDatabaseMigrator;
  const testDbFactory = new TestDbFactory();

  beforeAll(async () => {
    sql = await testDbFactory.createTestDatabase(faker.string.uuid());
    target = new PostgresDatabaseMigrator(sql);
  });

  afterAll(async () => {
    await testDbFactory.destroyTestDatabase(sql);
  });

  afterEach(() => {
    // Remove migrations folder after each test
    fs.rmSync(folder, { recursive: true, force: true });
  });

  describe('migrate', () => {
    afterEach(async () => {
      // Drop migrations table after each test
      await sql`drop table if exists migrations`;
    });

    it('should successfully migrate and keep track of last run migration', async () => {
      // Create migration folders and files
      for (const { name, file } of migrations) {
        const migrationPath = path.join(folder, name);
        fs.mkdirSync(migrationPath, { recursive: true });
        fs.writeFileSync(path.join(migrationPath, file.name), file.contents);
      }

      // Test migration and expect migrations to be recorded
      const executed = await target.migrate(folder);
      expect(executed).toHaveLength(3);
      await expect(sql`SELECT * FROM migrations`).resolves.toStrictEqual([
        {
          id: 1,
          name: 'initial',
          created_at: expect.any(Date),
        },
        {
          id: 2,
          name: 'update',
          created_at: expect.any(Date),
        },
        {
          id: 3,
          name: 'delete',
          created_at: expect.any(Date),
        },
      ]);
    });

    it('should migrate from the last run migration', async () => {
      const [initialMigration, ...remainingMigrations] = migrations;

      // Create initial migration folder and file
      const initialMigrationPath = path.join(folder, initialMigration.name);
      fs.mkdirSync(initialMigrationPath, { recursive: true });
      fs.writeFileSync(
        path.join(initialMigrationPath, initialMigration.file.name),
        initialMigration.file.contents,
      );

      // Migrate (only initial migration should be recorded)
      const executed = await target.migrate(folder);
      expect(executed).toHaveLength(1);
      const recordedMigrations = await sql`SELECT * FROM migrations`;
      expect(recordedMigrations).toStrictEqual([
        {
          id: 1,
          name: 'initial',
          created_at: expect.any(Date),
        },
      ]);

      // Add remaining migrations
      for (const { name, file } of remainingMigrations) {
        const migrationPath = path.join(folder, name);

        fs.mkdirSync(migrationPath, { recursive: true });
        fs.writeFileSync(path.join(migrationPath, file.name), file.contents);
      }

      // Migrate from last run migration
      const remaining = await target.migrate(folder);
      expect(remaining).toHaveLength(2);
      await expect(sql`SELECT * FROM migrations`).resolves.toStrictEqual([
        {
          id: 1,
          name: 'initial',
          // Was not run again
          created_at: recordedMigrations[0].created_at,
        },
        {
          id: 2,
          name: 'update',
          created_at: expect.any(Date),
        },
        {
          id: 3,
          name: 'delete',
          created_at: expect.any(Date),
        },
      ]);
    });

    it('throws if there are no migrations', async () => {
      // Create empty migrations folder
      fs.mkdirSync(folder, { recursive: true });

      await expect(target.migrate(folder)).rejects.toThrow(
        'No migrations found',
      );
    });

    it('should handle migration gaps correctly', async () => {
      // Create migrations with gaps in numbering (00001, 00005, 00010)
      const migrationsWithGaps = [
        {
          name: '00001_first',
          file: {
            name: 'index.sql',
            contents: `drop table if exists test;
                       create table test (a text);
                       insert into test (a) values ('first');`,
          },
        },
        {
          name: '00005_second',
          file: {
            name: 'index.sql',
            contents: `insert into test (a) values ('second');`,
          },
        },
        {
          name: '00010_third',
          file: {
            name: 'index.sql',
            contents: `insert into test (a) values ('third');`,
          },
        },
      ];

      // Create first migration and run it
      const firstMigrationPath = path.join(folder, migrationsWithGaps[0].name);
      fs.mkdirSync(firstMigrationPath, { recursive: true });
      fs.writeFileSync(
        path.join(firstMigrationPath, migrationsWithGaps[0].file.name),
        migrationsWithGaps[0].file.contents,
      );

      await target.migrate(folder);

      // Verify first migration was recorded
      const recordedAfterFirst = await sql`SELECT * FROM migrations`;
      expect(recordedAfterFirst).toStrictEqual([
        {
          id: 1,
          name: 'first',
          created_at: expect.any(Date),
        },
      ]);

      // Add remaining migrations with gaps (00005, 00010)
      for (const { name, file } of migrationsWithGaps.slice(1)) {
        const migrationPath = path.join(folder, name);
        fs.mkdirSync(migrationPath, { recursive: true });
        fs.writeFileSync(path.join(migrationPath, file.name), file.contents);
      }

      // Migrate from last run migration
      // This should run migrations 00005 and 00010, not skip them
      const remaining = await target.migrate(folder);
      expect(remaining).toHaveLength(2);

      // Verify all migrations were recorded correctly
      await expect(
        sql`SELECT * FROM migrations ORDER BY id`,
      ).resolves.toStrictEqual([
        {
          id: 1,
          name: 'first',
          created_at: recordedAfterFirst[0].created_at,
        },
        {
          id: 5,
          name: 'second',
          created_at: expect.any(Date),
        },
        {
          id: 10,
          name: 'third',
          created_at: expect.any(Date),
        },
      ]);

      // Verify all data was inserted correctly
      const testData = await sql`SELECT * FROM test ORDER BY a`;
      expect(testData).toStrictEqual([
        { a: 'first' },
        { a: 'second' },
        { a: 'third' },
      ]);

      // Clean up test table
      await sql`DROP TABLE IF EXISTS test`;
    });
  });

  describe('test', () => {
    it('should test migration', async () => {
      const [migration1, migration2, migration3] = migrations;

      // Create migration folder with first migration
      const migration1Path = path.join(folder, migration1.name);
      fs.mkdirSync(migration1Path, { recursive: true });
      fs.writeFileSync(
        path.join(migration1Path, migration1.file.name),
        migration1.file.contents,
      );

      // Test first migration
      await expect(
        target.test({
          migration: migration1.name,
          before: (sql) => sql`SELECT * FROM test`.catch(() => undefined),
          after: (sql): Promise<Array<TestRow>> =>
            sql<Array<TestRow>>`SELECT * FROM test`,
          folder,
        }),
      ).resolves.toStrictEqual({
        before: undefined,
        after: [
          {
            a: 'hello',
            b: 1337,
          },
        ],
      });

      // Should not track migrations when testing
      await expect(sql`SELECT * FROM migrations`).rejects.toThrow(
        'does not exist',
      );

      // Add second migration
      const migration2Path = path.join(folder, migration2.name);
      fs.mkdirSync(migration2Path, { recursive: true });
      fs.writeFileSync(
        path.join(migration2Path, migration2.file.name),
        migration2.file.contents,
      );

      // Test up to second migration
      await expect(
        target.test({
          migration: migration2.name,
          before: (sql): Promise<Array<TestRow>> =>
            sql<Array<TestRow>>`SELECT * FROM test`,
          after: (sql): Promise<Array<ExtendedTestRow>> =>
            sql<Array<ExtendedTestRow>>`SELECT * FROM test`,
          folder,
        }),
      ).resolves.toStrictEqual({
        before: [
          {
            a: 'hello',
            b: 1337,
          },
        ],
        after: [
          {
            a: 'hello',
            b: 1337,
            c: null,
          },
          {
            a: 'world',
            b: 69420,
            c: expect.any(Date),
          },
        ],
      });

      // Add third migration
      const migration3Path = path.join(folder, migration3.name);
      fs.mkdirSync(migration3Path, { recursive: true });
      fs.writeFileSync(
        path.join(migration3Path, migration3.file.name),
        migration3.file.contents,
      );

      // Test all migrations
      await expect(
        target.test({
          migration: migration3.name,
          before: (sql) => sql`SELECT * FROM test`,
          after: (sql) => sql`SELECT * FROM test`.catch(() => undefined),
          folder,
        }),
      ).resolves.toStrictEqual({
        before: [
          {
            a: 'hello',
            b: 1337,
            c: null,
          },
          {
            a: 'world',
            b: 69420,
            c: expect.any(Date),
          },
        ],
        // Final migration drops table
        after: undefined,
      });
    });

    it('throws if there are no migrations', async () => {
      // Create empty migrations folder
      fs.mkdirSync(folder, { recursive: true });

      await expect(
        target.test({ migration: '', after: Promise.resolve, folder }),
      ).rejects.toThrow('No migrations found');

      // Remove migrations folder
      fs.rmSync(folder, { recursive: true });
    });

    it('throws if migration is not found', async () => {
      // Create migration folders and files
      for (const { name, file } of migrations) {
        const migrationPath = path.join(folder, name);

        fs.mkdirSync(migrationPath, { recursive: true });
        fs.writeFileSync(path.join(migrationPath, file.name), file.contents);
      }

      await expect(
        target.test({ migration: '69420_hax', after: Promise.resolve, folder }),
      ).rejects.toThrow('Migration 69420_hax not found');

      // Remove migrations folder
      fs.rmSync(folder, { recursive: true });
    });
  });
});
