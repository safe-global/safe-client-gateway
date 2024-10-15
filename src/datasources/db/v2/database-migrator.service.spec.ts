import { join } from 'path';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { postgresConfig } from '@/config/entities/postgres.config';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import {
  LoggingService,
  type ILoggingService,
} from '@/logging/logging.interface';
import { DatabaseShutdownHook } from '@/datasources/db/v2/database-shutdown.hook';
import { DatabaseInitializeHook } from '@/datasources/db/v2/database-initialize.hook';

describe('PostgresDatabaseService', () => {
  let moduleRef: TestingModule;
  let postgresDatabaseService: PostgresDatabaseService;
  let databaseMigratorService: DatabaseMigrator;
  let loggingService: ILoggingService;

  beforeAll(async () => {
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

    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => {
            const typeormConfig = configService.getOrThrow('db.orm');
            const postgresConfigObject = postgresConfig(
              configService.getOrThrow('db.connection.postgres'),
            );

            return {
              ...typeormConfig,
              ...postgresConfigObject,
              ...{
                keepAlive: true,
                migrations: ['dist/migrations/test/*.js'],
              },
            };
          },
          inject: [ConfigService],
        }),
        TestLoggingModule,
        ConfigurationModule.register(testConfiguration),
        ConfigModule,
      ],
      providers: [
        PostgresDatabaseService,
        DatabaseMigrator,
        DatabaseInitializeHook,
        DatabaseShutdownHook,
        // DatabaseMigrationHook,
      ],
    }).compile();

    databaseMigratorService = moduleRef.get<DatabaseMigrator>(DatabaseMigrator);
    postgresDatabaseService = moduleRef.get<PostgresDatabaseService>(
      PostgresDatabaseService,
    );
    loggingService = moduleRef.get<ILoggingService>(LoggingService);

    await postgresDatabaseService.initializeDatabaseConnection();
  });

  afterAll(async () => {
    await postgresDatabaseService.destroyDatabaseConnection();
    await moduleRef.close();
  });

  describe('migrate()', () => {
    it('Should log the start and end of the migration process', async () => {
      jest.spyOn(loggingService, 'info');

      await databaseMigratorService.migrate();

      expect(loggingService.info).toHaveBeenCalledWith(
        'Migrations: Running...',
      );
      expect(loggingService.info).toHaveBeenCalledWith('Migrations: Finished.');
    });
  });
});
