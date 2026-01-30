import { join } from 'path';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConfigModule } from '@nestjs/config';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { type ILoggingService } from '@/logging/logging.interface';
import type { DataSource } from 'typeorm';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { mockPostgresDataSource } from '@/datasources/db/v2/__tests__/postgresql-datasource.mock';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('PostgresDatabaseService', () => {
  let moduleRef: TestingModule;
  let databaseMigratorService: DatabaseMigrator;
  let postgresDatabaseService: PostgresDatabaseService;
  const NUMBER_OF_RETRIES = 2;
  const LOCK_TABLE_NAME = '_lock';
  const truncateLockQuery = `TRUNCATE TABLE "${LOCK_TABLE_NAME}";`;
  const connection: jest.MockedObjectDeep<DataSource> = mockPostgresDataSource;
  const insertLockQuery = `INSERT INTO "${LOCK_TABLE_NAME}" (status) VALUES ($1);`;

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
          executeMigrations: false,
          retryAfterMs: 10,
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

    const configService = moduleRef.get<ConfigService>(ConfigService);
    postgresDatabaseService = new PostgresDatabaseService(
      mockLoggingService,
      connection,
    );

    databaseMigratorService = new DatabaseMigrator(
      mockLoggingService,
      postgresDatabaseService,
      configService,
    );
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(() => {});

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('migrate()', () => {
    it('Should log the start and end of the migration process', async () => {
      await databaseMigratorService.migrate();

      expect(mockLoggingService.info).toHaveBeenCalledWith(
        'Migrations: Running...',
      );
      expect(mockLoggingService.info).toHaveBeenCalledWith(
        'Migrations: Finished.',
      );
      expect(mockLoggingService.info).toHaveBeenCalledTimes(4);
    });

    it('Should run migration if no lock exists', async () => {
      await databaseMigratorService.migrate();

      expect(connection.runMigrations).toHaveBeenCalled();
      expect(connection.query).toHaveBeenCalledWith(insertLockQuery, [1]);
      expect(connection.runMigrations).toHaveBeenCalled();

      expect(connection.query).toHaveBeenCalledWith(truncateLockQuery);
    });

    it('Should throw an error if retries are exhausted', async () => {
      connection.query.mockResolvedValue([{ id: 1, status: 1 }]);

      await expect(databaseMigratorService.migrate()).rejects.toThrow(
        'Migrations: Migrations are still running in another instance!',
      );

      expect(mockLoggingService.info).toHaveBeenNthCalledWith(
        1,
        'Migrations: Running...',
      );
      expect(mockLoggingService.info).toHaveBeenNthCalledWith(
        3,
        'Migrations: Running in another instance...',
      );
      expect(mockLoggingService.info).toHaveBeenCalledTimes(3);
    });

    it('Should truncate locks if a migration error occurs', async () => {
      connection.query.mockResolvedValue(jest.fn());
      connection.runMigrations.mockRejectedValue(() => {
        throw new Error('Migration Error');
      });

      await expect(databaseMigratorService.migrate()).rejects.toThrow(
        'Migration Error',
      );

      expect(connection.query).toHaveBeenNthCalledWith(4, truncateLockQuery);
    });

    it('Should not truncate locks if retries are exhausted', async () => {
      connection.query.mockResolvedValue([{ id: 1, status: 1 }]);

      await expect(databaseMigratorService.migrate()).rejects.toThrow(
        'Migrations: Migrations are still running in another instance!',
      );

      expect(connection.query).not.toHaveBeenCalledWith(truncateLockQuery);
    });

    it('Should truncate locks after migrations are successful', async () => {
      connection.query.mockResolvedValue(jest.fn());

      await databaseMigratorService.migrate();

      expect(mockLoggingService.info).toHaveBeenCalledTimes(4);
      expect(mockLoggingService.info).toHaveBeenNthCalledWith(
        4,
        'Migrations: Finished.',
      );

      expect(connection.query).toHaveBeenCalledWith(truncateLockQuery);
    });
  });
});
