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

describe('PostgresDatabaseService', () => {
  let databaseMigratorService: DatabaseMigrator;
  let loggingService: ILoggingService;

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
              ...{
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
      providers: [PostgresDatabaseService, DatabaseMigrator],
    }).compile();

    databaseMigratorService = moduleRef.get<DatabaseMigrator>(DatabaseMigrator);
    loggingService = moduleRef.get<ILoggingService>(LoggingService);
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
