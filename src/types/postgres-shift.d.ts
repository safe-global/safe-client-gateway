declare module 'postgres-shift' {
  import { Sql } from 'postgres';

  /**
   * Shift the database to the latest migration.
   *
   * @param options.sql - The SQL instance to use.
   * @param options.path - The path of the migrations directory.
   * @param options.before - A callback to run before each migration.
   * @param options.after - A callback to run after each migration.
   *
   * Note: this definition is for postgres-shit@0.1.0.
   * @see https://github.com/porsager/postgres-shift/blob/e7a4cb16d66c33c73f4f730b7d1de33b7757fea9/index.js
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export default async (options: {
    sql: Sql;
    path?: string;
    before?: (args: { migration_id: string; name: string }) => void;
    after?: (args: { migration_id: string; name: string }) => void;
  }): Promise<void> => {};
}
