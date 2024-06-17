import { dbFactory } from '@/__tests__/db.factory';
import { PostgresDatabaseMigrator } from '@/datasources/db/postgres-database.migrator';

describe('Migrations', () => {
  const sql = dbFactory();
  const migrator = new PostgresDatabaseMigrator(sql);

  it('run successfully', async () => {
    await expect(migrator.migrate()).resolves.not.toThrow();

    await sql.end();
  });
});
