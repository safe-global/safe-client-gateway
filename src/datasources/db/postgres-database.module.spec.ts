import { Test } from '@nestjs/testing';
import { PostgresDatabaseModule } from '@/datasources/db/postgres-database.module';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import postgres from 'postgres';
import { join } from 'path';

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
        postgres: {
          ...baseConfiguration.db.postgres,
          ssl: {
            ...baseConfiguration.db.postgres.ssl,
            enabled: !isCIContext,
            caPath: join(__dirname, '../../../db_config/test/server.crt'),
          },
        },
      },
    });

    const moduleRef = await Test.createTestingModule({
      imports: [
        PostgresDatabaseModule,
        ConfigurationModule.register(testConfiguration),
        TestLoggingModule,
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
