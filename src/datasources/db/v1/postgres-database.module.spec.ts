import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { Test } from '@nestjs/testing';
import { join } from 'path';
import type postgres from 'postgres';

describe('PostgresDatabaseModule tests', () => {
  let sql: postgres.Sql;

  beforeEach(async () => {
    // We should not require an SSL connection if using the database provided
    // by GitHub actions
    const isCIContext = process.env.CI?.toLowerCase() === 'true';
    const baseConfiguration = configuration();
    const testConfiguration: typeof configuration = () => ({
      ...baseConfiguration,
      db: {
        ...baseConfiguration.db,
        connection: {
          postgres: {
            ...baseConfiguration.db.connection.postgres,
            ssl: {
              ...baseConfiguration.db.connection.postgres.ssl,
              enabled: !isCIContext,
              caPath: join(__dirname, '../../../../db_config/test/server.crt'),
            },
          },
        },
      },
    });

    const moduleRef = await Test.createTestingModule({
      imports: [
        PostgresDatabaseModule,
        ConfigurationModule.register(testConfiguration),
        TestLoggingModule,
        TestCacheModule,
      ],
    }).compile();

    sql = moduleRef.get('DB_INSTANCE');
  });

  afterEach(async () => {
    await sql.end();
  });

  it('connection is successful', async () => {
    await sql`SELECT NOW() as current_time`;
  });
});
