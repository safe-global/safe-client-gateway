import postgres from 'postgres';
import fs from 'node:fs';
import path from 'node:path';
import configuration from '@/config/entities/__tests__/configuration';

export class TestDbFactory {
  private static readonly TEST_CERTIFICATE_PATH = path.join(
    process.cwd(),
    'db_config/test/server.crt',
  );
  private readonly config = configuration();
  private readonly isCIContext = process.env.CI?.toLowerCase() === 'true';
  private readonly mainConnection: postgres.Sql;

  constructor() {
    this.mainConnection = this.connect(this.config.db.postgres.database);
  }

  async createTestDatabase(dbName: string): Promise<postgres.Sql> {
    await this.mainConnection`create database ${this.mainConnection(dbName)}`;
    return this.connect(dbName);
  }

  async destroyTestDatabase(database: postgres.Sql): Promise<void> {
    await database.end();
    await this
      .mainConnection`drop database ${this.mainConnection(database.options.database)} with (force)`;
    await this.mainConnection.end();
  }

  /**
   * Connect to the database pointed by the `dbName` parameter.
   *
   * If running on a CI context (e.g.: GitHub Actions),
   * certificate pinning is disabled for the test execution.
   *
   * @param dbName - database name
   * @returns {@link postgres.Sql} pointing to the database
   */
  private connect(dbName: string): postgres.Sql {
    const { host, port, username, password, ssl } = this.config.db.postgres;
    const sslEnabled = !this.isCIContext && ssl.enabled;
    return postgres({
      host,
      port: parseInt(port),
      db: dbName,
      user: username,
      password,
      ssl: sslEnabled
        ? {
            requestCert: ssl.requestCert,
            rejectUnauthorized: ssl.rejectUnauthorized,
            ca: fs.readFileSync(TestDbFactory.TEST_CERTIFICATE_PATH, 'utf8'),
          }
        : false,
    });
  }
}
