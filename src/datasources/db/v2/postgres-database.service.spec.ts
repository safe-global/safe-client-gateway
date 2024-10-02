import { join } from 'path';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { postgresConfig } from '@/config/entities/postgres.config';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { DataSource, type Repository } from 'typeorm';

describe('PostgresDatabaseService', () => {
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

  describe('getDataSource()', () => {
    it('Should return the datasource', () => {
      const result = postgresqlService.getDataSource();

      expect(result).toBeInstanceOf(DataSource);
    });
  });

  describe('isInitialized()', () => {
    it('Should return true if the datasource has been initialized', async () => {
      await postgresqlService.initializeDatabaseConnection();

      const isInitialized = postgresqlService.isInitialized();

      expect(isInitialized).toBe(true);
    });

    it('should return false if the data source has not been initialized', () => {
      const isInitialized = postgresqlService.isInitialized();

      expect(isInitialized).toBe(false);
    });
  });

  describe('initializeDatabaseConnection()', () => {
    it('Should initialize the data source if not initialized', async () => {
      const isPrematurelyInitialized = postgresqlService.isInitialized();
      await postgresqlService.initializeDatabaseConnection();

      const isInitialized = postgresqlService.isInitialized();

      expect(isPrematurelyInitialized).toBe(false);
      expect(isInitialized).toBe(true);
    });

    it('should return the data source if already initialized', async () => {
      const result = await postgresqlService.initializeDatabaseConnection();

      expect(result.query).not.toBeUndefined();
    });
  });

  describe('destroyDatabaseConnection()', () => {
    it('Should destroy the data source if initialized', async () => {
      await postgresqlService.initializeDatabaseConnection();
      const isInitialized = postgresqlService.isInitialized();

      await postgresqlService.destroyDatabaseConnection();
      const isDatasourceAlive = postgresqlService.isInitialized();

      expect(isInitialized).toBe(true);
      expect(isDatasourceAlive).toBe(false);
    });
  });

  describe('getRepository()', () => {
    class MockEntity {}

    it('Should return a repository for the given entity', async () => {
      const mockRepository = {} as Repository<MockEntity>;
      postgresqlService.getRepository = jest
        .fn()
        .mockReturnValue(mockRepository);

      const result = await postgresqlService.getRepository(MockEntity);

      expect(postgresqlService.getRepository).toHaveBeenCalledWith(MockEntity);
      expect(result).toBe(mockRepository);
    });

    it('Should fetch the database connection before returning the repository', async () => {
      const fetchConnectionSpy = jest.spyOn(
        postgresqlService,
        'initializeDatabaseConnection',
      );
      await postgresqlService.getRepository(MockEntity);

      expect(fetchConnectionSpy).toHaveBeenCalled();
    });
  });
});
