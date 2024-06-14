// Note: the is a helper function to test migrations by postgres-shift.
// @see https://github.com/porsager/postgres-shift/blob/e7a4cb16d66c33c73f4f730b7d1de33b7757fea9/index.js

import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { Migration } from 'postgres-shift';

const SQL_MIGRATION_FILE = 'index.sql';
const JS_MIGRATION_FILE = 'index.js';

/**
 * The following allows for migration testing in accordance with the
 * p ostgres-shift library.
 *
 * The provided migration is tested against the provided SQL instance,
 * calling the before and after functions before and after the migration
 * is applied, respectively.
 *
 * Not: all migrations prior to that specified are applied before.
 *
 * @param args.migration - the migration to test, matching the folder name
 * @param args.sql - the SQL instance to test against
 * @param args.before - the function to call before the migration is applied
 * @param args.after - the function to call after the migration is applied
 * @param args.folder - the folder containing migrations (=root 'migrations')
 *
 * @returns the before and after results returned by before/after functions
 */
export async function migrationTester(args: {
  migration: string;
  sql: postgres.Sql;
  before?: (sql: postgres.Sql) => Promise<unknown>;
  after: (sql: postgres.Sql) => Promise<unknown>;
  folder?: string;
}): Promise<{
  before: unknown;
  after: unknown;
}> {
  const migrations = getMigrations(args.folder);

  if (migrations.length === 0) {
    throw new Error('No migrations found');
  }

  const latest = migrations.at(-1);
  if (latest?.migration_id !== migrations.length) {
    throw new Error('Migrations numbered inconsistency');
  }

  let before: unknown;

  shift: for await (const migration of migrations) {
    const isSql = fs.existsSync(path.join(migration.path, SQL_MIGRATION_FILE));
    const isJs = fs.existsSync(path.join(migration.path, JS_MIGRATION_FILE));

    if (!isSql && !isJs) {
      throw new Error(`No migration file found for ${migration.path}`);
    }

    const isMigrationBeingTested = migration.path.includes(args.migration);

    if (isMigrationBeingTested && args.before) {
      before = await args.before(args.sql).catch(() => undefined);
    }

    await args.sql.begin(async (transaction) => {
      if (isSql) {
        await transaction.file(path.join(migration.path, SQL_MIGRATION_FILE));
      } else {
        const file = (await import(
          path.join(migration.path, JS_MIGRATION_FILE)
        )) as {
          default: (transaction: postgres.TransactionSql) => Promise<void>;
        };
        await file.default(transaction);
      }
    });

    if (isMigrationBeingTested) {
      break shift;
    }
  }

  const after = await args.after(args.sql).catch(() => undefined);

  return { before, after };
}

function getMigrations(
  folder = path.join(process.cwd(), 'migrations'),
): Array<Migration> {
  return fs
    .readdirSync(folder)
    .filter((file) => {
      const isDirectory = fs.statSync(path.join(folder, file)).isDirectory();
      const isMigration = file.match(/^[0-9]{5}_/);
      return isDirectory && isMigration;
    })
    .sort()
    .map((file) => {
      return {
        path: path.join(folder, file),
        migration_id: parseInt(file.slice(0, 5)),
        name: file.slice(6),
      };
    });
}
