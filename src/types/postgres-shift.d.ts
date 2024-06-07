declare module 'postgres-shift' {
  import { Sql } from 'postgres';

  // https://github.com/porsager/postgres-shift/blob/master/index.js
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export default async (options: {
    sql: Sql;
    path?: string;
    before?: boolean | null;
    after?: boolean | null;
  }): Promise<unknown> => {};
}
