declare module 'postgres-shift' {
  type Migration = {
    path: string;
    migration_id: number;
    name: string;
  };

  export default async function (options: {
    sql: import('postgres').Sql;
    path?: string;
    before?: ((migration: Migration) => unknown) | null;
    after?: ((migration: Migration) => unknown) | null;
  }): Promise<unknown>;
}
