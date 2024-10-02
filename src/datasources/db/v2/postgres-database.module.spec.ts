import { join } from 'path';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { postgresConfig } from '@/config/entities/postgres.config';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';

describe('PostgresDatabaseModuleV2', () => {
  let postgresqlService: PostgresDatabaseService;

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

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: async (configService: ConfigService) => {
            const typeormConfig = await configService.getOrThrow('db.orm');
            const postgresConfigObject = postgresConfig(
              await configService.getOrThrow('db.connection.postgres'),
            );

            return {
              ...typeormConfig,
              ...postgresConfigObject,
            };
          },
          inject: [ConfigService],
        }),
        TestLoggingModule,
        ConfigurationModule.register(testConfiguration),
      ],
      providers: [PostgresDatabaseService],
    }).compile();

    postgresqlService = moduleRef.get<PostgresDatabaseService>(
      PostgresDatabaseService,
    );
  });

  afterAll(async () => {
    await postgresqlService.destroyDatabaseConnection();
  });

  it('Should establish a successful connection', async () => {
    const connection = await postgresqlService.initializeDatabaseConnection();

    await connection.query('SELECT now() as current_timestamp');
  });
});
