import configuration from '@/config/entities/__tests__/configuration';
import postgres from 'postgres';
import path from 'node:path';
import fs from 'node:fs';
import { migrationTester } from '@/__tests__/migration-tester';

const folder = path.join(__dirname, 'migrations');
const migrations: Array<{
  name: string;
  file: { name: string; contents: string };
}> = [
  {
    name: '00001_initial',
    file: {
      name: 'index.sql',
      contents: `create table test (
                   a text,
                   b int
                 );

                 insert into test (a, b) values ('hello', 1);`,
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
                    insert into test (a, b, c) values ('hello', 9, \${new Date()})
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

describe('migrationTester', () => {
  let sql: postgres.Sql;

  beforeEach(async () => {
    const config = configuration();

    const isCIContext = process.env.CI?.toLowerCase() === 'true';

    sql = postgres({
      host: config.db.postgres.host,
      port: parseInt(config.db.postgres.port),
      db: config.db.postgres.database,
      user: config.db.postgres.username,
      password: config.db.postgres.password,
      // If running on a CI context (e.g.: GitHub Actions),
      // disable certificate pinning for the test execution
      ssl:
        isCIContext || !config.db.postgres.ssl.enabled
          ? false
          : {
              requestCert: config.db.postgres.ssl.requestCert,
              rejectUnauthorized: config.db.postgres.ssl.rejectUnauthorized,
              ca: fs.readFileSync(
                path.join(process.cwd(), 'db_config/test/server.crt'),
                'utf8',
              ),
            },
    });
  });

  afterEach(async () => {
    await sql`TRUNCATE TABLE test CASCADE`;
    fs.rmSync(folder, { recursive: true, force: true });
  });

  it('should test migrations', async () => {
    const [migration1, migration2, migration3] = migrations;

    // Create migration folders and add first migration
    const migration1Path = path.join(folder, migration1.name);
    fs.mkdirSync(migration1Path, { recursive: true });
    fs.writeFileSync(
      path.join(migration1Path, migration1.file.name),
      migration1.file.contents,
    );

    // Test migration
    const result1 = await migrationTester({
      sql,
      migration: migration1.name,
      before: (sql) => sql`SELECT * FROM test`,
      after: (sql) => sql`SELECT * FROM test`,
      folder,
    });

    expect(result1.before).toBeUndefined();
    expect(result1.after).toStrictEqual([
      {
        a: 'hello',
        b: 1,
      },
    ]);

    // Add second migration
    const migration2Path = path.join(folder, migration2.name);
    fs.mkdirSync(migration2Path, { recursive: true });
    fs.writeFileSync(
      path.join(migration2Path, migration2.file.name),
      migration2.file.contents,
    );

    // Test migration
    const result2 = await migrationTester({
      sql,
      migration: migration2.name,
      before: (sql) => sql`SELECT * FROM test`,
      after: (sql) => sql`SELECT * FROM test`,
      folder,
    });

    expect(result2.before).toStrictEqual([
      {
        a: 'hello',
        b: 1,
      },
    ]);
    expect(result2.after).toStrictEqual([
      {
        a: 'hello',
        b: 9,
        c: expect.any(Date),
      },
    ]);

    // Add third migration
    const migration3Path = path.join(folder, migration3.name);
    fs.mkdirSync(migration3Path, { recursive: true });
    fs.writeFileSync(
      path.join(migration3Path, migration3.file.name),
      migration3.file.contents,
    );

    const result3 = await migrationTester({
      sql,
      migration: migration3.name,
      before: (sql) => sql`SELECT * FROM test`,
      after: (sql) => sql`SELECT * FROM test`,
      folder,
    });

    // Test migration
    expect(result3.before).toStrictEqual([
      {
        a: 'hello',
        b: 9,
        c: expect.any(Date),
      },
    ]);
    expect(result3.after).toBeUndefined();

    fs.rmSync(folder, { recursive: true });
  });

  it('clears the migrations table after running the migrations', async () => {
    const [migration] = migrations;

    // Create migration folders and add first migration
    const migrationPath = path.join(folder, migration.name);
    fs.mkdirSync(migrationPath, { recursive: true });
    fs.writeFileSync(
      path.join(migrationPath, migration.file.name),
      migration.file.contents,
    );

    await migrationTester({
      sql,
      migration: migration.name,
      after: () => Promise.resolve(),
      folder,
    });

    const result = await sql`SELECT * FROM migrations`;

    expect(result).toStrictEqual([]);

    fs.rmSync(folder, { recursive: true });
  });

  it("doesn't run if there are no migrations", async () => {
    await expect(
      migrationTester({
        sql,
        migration: '',
        after: Promise.resolve,
        folder: __dirname,
      }),
    ).rejects.toThrow('No migrations found');
  });

  it('throws if there is inconsistent numbering', async () => {
    // Ignore the second so that naming is 00001, 00003
    const [migration1, _, migration3] = migrations;

    for (const migration of [migration1, migration3]) {
      // Create migration folders and add first migration
      const migrationPath = path.join(folder, migration.name);
      fs.mkdirSync(migrationPath, { recursive: true });
      fs.writeFileSync(
        path.join(migrationPath, migration.file.name),
        migration.file.contents,
      );
    }

    await expect(
      migrationTester({
        sql,
        migration: '',
        after: Promise.resolve,
        folder,
      }),
    ).rejects.toThrow('Migrations numbered inconsistency');
  });
});
