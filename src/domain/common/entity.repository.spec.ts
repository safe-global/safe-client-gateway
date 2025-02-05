import { faker } from '@faker-js/faker';
import { DataSource } from 'typeorm';
import configuration from '@/config/entities/__tests__/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { User } from '@/datasources/users/entities/users.entity.db';
import { Wallet } from '@/datasources/wallets/entities/wallets.entity.db';
import { UserStatus } from '@/domain/users/entities/user.entity';
import { EntityRepository } from '@/domain/common/entity.repository';
import type { ConfigService } from '@nestjs/config';
import type { ILoggingService } from '@/logging/logging.interface';

const mockLoggingService = {
  info: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

class TestEntityRepository extends EntityRepository<User> {
  constructor(postgresDatabaseService: PostgresDatabaseService) {
    super(postgresDatabaseService, User);
  }
}

describe('EntityRepository', () => {
  let postgresDatabaseService: PostgresDatabaseService;
  let testEntityRepository: TestEntityRepository;

  const testDatabaseName = faker.string.alpha({
    length: 10,
    casing: 'lower',
  });
  const testConfiguration = configuration();

  const dataSource = new DataSource({
    ...postgresConfig({
      ...testConfiguration.db.connection.postgres,
      type: 'postgres',
      database: testDatabaseName,
    }),
    migrationsTableName: testConfiguration.db.orm.migrationsTableName,
    entities: [User, Wallet],
  });
  const userRepository = dataSource.getRepository(User);

  beforeAll(async () => {
    // Create database
    const testDataSource = new DataSource({
      ...postgresConfig({
        ...testConfiguration.db.connection.postgres,
        type: 'postgres',
        database: 'postgres',
      }),
    });
    const testPostgresDatabaseService = new PostgresDatabaseService(
      mockLoggingService,
      testDataSource,
    );
    await testPostgresDatabaseService.initializeDatabaseConnection();
    await testPostgresDatabaseService
      .getDataSource()
      .query(`CREATE DATABASE ${testDatabaseName}`);
    await testPostgresDatabaseService.destroyDatabaseConnection();

    // Create database connection
    postgresDatabaseService = new PostgresDatabaseService(
      mockLoggingService,
      dataSource,
    );
    await postgresDatabaseService.initializeDatabaseConnection();

    // Migrate database
    const mockConfigService = {
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        if (key === 'db.migrator.numberOfRetries') {
          return testConfiguration.db.migrator.numberOfRetries;
        }
        if (key === 'db.migrator.retryAfterMs') {
          return testConfiguration.db.migrator.retryAfterMs;
        }
      }),
    } as jest.MockedObjectDeep<ConfigService>;
    const migrator = new DatabaseMigrator(
      mockLoggingService,
      postgresDatabaseService,
      mockConfigService,
    );
    await migrator.migrate();

    testEntityRepository = new TestEntityRepository(postgresDatabaseService);
  });

  afterEach(async () => {
    jest.resetAllMocks();

    // Truncate table
    await userRepository.createQueryBuilder().delete().where('1=1').execute();
  });

  afterAll(async () => {
    await postgresDatabaseService.getDataSource().dropDatabase();
    await postgresDatabaseService.destroyDatabaseConnection();
  });

  describe('findOneOrFail', () => {
    it('should find an entity', async () => {
      const insert = await userRepository.insert({
        status: faker.helpers.enumValue(UserStatus),
      });

      const entity = await testEntityRepository.findOneOrFail({
        where: { id: insert.identifiers[0].id },
      });

      expect(entity).toEqual(
        expect.objectContaining({
          id: insert.identifiers[0].id,
        }),
      );
    });

    it('should throw an error if no entity is found', async () => {
      await expect(
        testEntityRepository.findOneOrFail({ where: {} }),
      ).rejects.toThrow('User not found.');
    });
  });

  describe('findOne', () => {
    it('should find an entity', async () => {
      const insert = await userRepository.insert({
        status: faker.helpers.enumValue(UserStatus),
      });

      const entity = await testEntityRepository.findOne({
        where: {},
      });

      expect(entity).toEqual(
        expect.objectContaining({
          id: insert.identifiers[0].id,
        }),
      );
    });

    it('should return null if no entity is found', async () => {
      const entity = await testEntityRepository.findOne({
        where: {},
      });

      expect(entity).toBeNull();
    });
  });

  describe('findOrFail', () => {
    it('should find entities', async () => {
      const insert1 = await userRepository.insert({
        status: faker.helpers.enumValue(UserStatus),
      });
      const insert2 = await userRepository.insert({
        status: faker.helpers.enumValue(UserStatus),
      });

      const entities = await testEntityRepository.findOrFail({ where: {} });

      expect(entities).toEqual([
        expect.objectContaining({
          id: insert1.identifiers[0].id,
        }),
        expect.objectContaining({
          id: insert2.identifiers[0].id,
        }),
      ]);
    });

    it('should throw an error if no entities are found', async () => {
      await expect(
        testEntityRepository.findOrFail({ where: {} }),
      ).rejects.toThrow('Users not found.');
    });
  });

  describe('find', () => {
    it('should find entities', async () => {
      const insert1 = await userRepository.insert({
        status: faker.helpers.enumValue(UserStatus),
      });
      const insert2 = await userRepository.insert({
        status: faker.helpers.enumValue(UserStatus),
      });

      const entities = await testEntityRepository.findOrFail({ where: {} });

      expect(entities).toEqual([
        expect.objectContaining({
          id: insert1.identifiers[0].id,
        }),
        expect.objectContaining({
          id: insert2.identifiers[0].id,
        }),
      ]);
    });

    it('should return an empty array if no entities are found', async () => {
      await expect(testEntityRepository.find({ where: {} })).resolves.toEqual(
        [],
      );
    });
  });
});
