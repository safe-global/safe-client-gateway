import { join } from 'path';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import {
  LoggingService,
  type ILoggingService,
} from '@/logging/logging.interface';
import type { DataSource } from 'typeorm';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';

describe('PostgresDatabaseService', () => {
  let moduleRef: TestingModule;
  let postgresDatabaseService: PostgresDatabaseService;
  let databaseMigratorService: DatabaseMigrator;
  let loggingService: ILoggingService;
  let connection: DataSource;
  const NUMBER_OF_RETRIES = 2;
  const truncateLockQuery = 'TRUNCATE TABLE "_lock";';
  const insertLockQuery = 'INSERT INTO "_lock" (status) VALUES ($1);';

  beforeAll(async () => {
    // We should not require an SSL connection if using the database provided
    // by GitHub actions
    const isCIContext = process.env.CI?.toLowerCase() === 'true';
    const baseConfiguration = configuration();
    const testConfiguration: typeof configuration = () => ({
      ...baseConfiguration,
      db: {
        ...baseConfiguration.db,
        migrator: {
          numberOfRetries: NUMBER_OF_RETRIES,
          migrationsExecute: false,
          retryAfter: 10,
        },
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
        TestLoggingModule,
        ConfigurationModule.register(testConfiguration),
        ConfigModule,
        TestPostgresDatabaseModuleV2,
      ],
      providers: [DatabaseMigrator],
    }).compile();

    databaseMigratorService = moduleRef.get<DatabaseMigrator>(DatabaseMigrator);
    postgresDatabaseService = moduleRef.get<PostgresDatabaseService>(
      PostgresDatabaseService,
    );
    loggingService = moduleRef.get<ILoggingService>(LoggingService);

    connection = postgresDatabaseService.getDataSource();
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(() => {});

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('migrate()', () => {
    it('Should log the start and end of the migration process', async () => {
      jest.spyOn(loggingService, 'info');

      await databaseMigratorService.migrate();

      expect(loggingService.info).toHaveBeenCalledWith(
        'Migrations: Running...',
      );
      expect(loggingService.info).toHaveBeenCalledWith('Migrations: Finished.');
      expect(loggingService.info).toHaveBeenCalledTimes(3);
    });

    it('Should run migration if no lock exists', async () => {
      jest.spyOn(connection, 'query').mockImplementation(jest.fn());

      await databaseMigratorService.migrate();

      expect(connection.runMigrations).toHaveBeenCalled();
      expect(connection.query).toHaveBeenCalledWith(insertLockQuery, [1]);

      expect(connection.query).toHaveBeenCalledWith(truncateLockQuery);
    });

    it('Should throw an error if retries are exhausted', async () => {
      connection.query = jest.fn().mockResolvedValue([{ id: 1, status: 1 }]);

      await expect(databaseMigratorService.migrate()).rejects.toThrow(
        'Migrations: Migrations are still running in another instance!',
      );

      expect(loggingService.info).toHaveBeenCalledWith(
        'Migrations: Running in another instance...',
      );
      expect(loggingService.info).toHaveBeenCalledTimes(2);
    });

    it('Should not truncate locks if an error occurs', async () => {
      connection.query = jest.fn().mockResolvedValue([{ id: 1, status: 1 }]);

      await expect(databaseMigratorService.migrate()).rejects.toThrow(
        'Migrations: Migrations are still running in another instance!',
      );

      expect(connection.query).not.toHaveBeenCalledWith(truncateLockQuery);
    });

    it('Should truncate locks after migrations are successful', async () => {
      connection.query = jest.fn().mockResolvedValue(jest.fn());

      await databaseMigratorService.migrate();

      expect(loggingService.info).toHaveBeenCalledTimes(3);
      expect(loggingService.info).toHaveBeenCalledWith('Migrations: Finished.');

      expect(connection.query).toHaveBeenCalledWith(truncateLockQuery);
    });
  });
});
