import { faker } from '@faker-js/faker';
import { DataSource } from 'typeorm';
import configuration from '@/config/entities/__tests__/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { User } from '@/datasources/users/entities/users.entity.db';
import { Wallet } from '@/datasources/wallets/entities/wallets.entity.db';
import type { ConfigService } from '@nestjs/config';
import type { ILoggingService } from '@/logging/logging.interface';
import { UserOrganization } from '@/datasources/users/entities/user-organizations.entity.db';
import { Organization } from '@/datasources/organizations/entities/organizations.entity.db';
import { OrganizationsRepository } from '@/domain/organizations/organizations.repository';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('OrganizationsRepository', () => {
  let postgresDatabaseService: PostgresDatabaseService;
  let orgRepo: OrganizationsRepository;

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
    entities: [UserOrganization, Organization, User, Wallet],
  });

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

    orgRepo = new OrganizationsRepository(postgresDatabaseService);
  });

  afterEach(async () => {
    jest.resetAllMocks();

    await Promise.all(
      [UserOrganization, Organization, User, Wallet].map(async (entity) => {
        const repository = dataSource.getRepository(entity);
        return await repository
          .createQueryBuilder()
          .delete()
          .where('1=1')
          .execute();
      }),
    );
  });

  afterAll(async () => {
    await postgresDatabaseService.getDataSource().dropDatabase();
    await postgresDatabaseService.destroyDatabaseConnection();
  });

  // As the triggers are set on the database level, Jest's fake timers are not accurate
  describe('createdAt/updatedAt', () => {
    it('should set createdAt and updatedAt when creating a User', async () => {
      const before = new Date().getTime();

      const dbOrgRepo = dataSource.getRepository(Organization);
      const org = await dbOrgRepo.insert({
        name: faker.word.noun(),
        status: 'ACTIVE',
      });

      const after = new Date().getTime();

      const createdAt = org.generatedMaps[0].createdAt;
      const updatedAt = org.generatedMaps[0].updatedAt;

      if (!(createdAt instanceof Date) || !(updatedAt instanceof Date)) {
        throw new Error('createdAt and/or updatedAt is not a Date');
      }

      expect(createdAt).toEqual(updatedAt);

      const createdAtTime = createdAt.getTime();
      const updatedAtTime = updatedAt.getTime();

      expect(createdAtTime).toBeGreaterThanOrEqual(before);
      expect(createdAtTime).toBeLessThanOrEqual(after);

      expect(updatedAtTime).toBeGreaterThanOrEqual(before);
      expect(updatedAtTime).toBeLessThanOrEqual(after);
    });

    it('should update updatedAt when updating a User', async () => {
      const dbOrgRepo = dataSource.getRepository(Organization);
      const prevOrg = await dbOrgRepo.insert({
        name: faker.word.noun(),
        status: 'ACTIVE',
      });
      const orgId = prevOrg.identifiers[0].id as User['id'];
      await dbOrgRepo.update(orgId, {
        name: faker.word.noun(),
      });
      const updatedOrg = await dbOrgRepo.findOneOrFail({
        where: { id: orgId },
      });

      const prevUpdatedAt = prevOrg.generatedMaps[0].updatedAt;

      if (!(prevUpdatedAt instanceof Date)) {
        throw new Error('prevUpdatedAt is not a Date');
      }

      const updatedAtTime = updatedOrg.updatedAt.getTime();

      expect(updatedOrg.createdAt.getTime()).toBeLessThan(updatedAtTime);
      expect(prevUpdatedAt.getTime()).toBeLessThanOrEqual(updatedAtTime);
    });
  });

  describe('create', () => {
    it.todo('should create an organization with an ACTIVE ADMIN user');

    it.todo('should throw if the user does not exist');
  });

  describe('findOneOrFail', () => {
    it.todo('should find an organization');

    it.todo('should throw an error if the organization does not exist');
  });

  describe('findOne', () => {
    it.todo('should find an organization');

    it.todo('should return null if the organization does not exist');
  });

  describe('findOrFail', () => {
    it.todo('should find organizations');

    it.todo('should throw an error if organizations do not exist');
  });

  describe('find', () => {
    it.todo('should find organizations');

    it.todo('should return an empty array if organizations do not exist');
  });

  describe('findByUserIdOrFail', () => {
    it.todo('should find organizations by user id');

    it.todo('should throw an error if organizations do not exist');
  });

  describe('findByUserId', () => {
    it.todo('should find organizations by user id');

    it.todo('should return an empty array if organizations do not exist');
  });

  describe('findOneByUserIdOrFail', () => {
    it.todo('should find an organization by user id');

    it.todo('should throw an error if the organization does not exist');
  });

  describe('findOneByUserId', () => {
    it.todo('should find an organization by user id');

    it.todo('should return null if the organization does not exist');
  });

  describe('update', () => {
    it.todo('should update an organization');
  });

  describe('delete', () => {
    it.todo('should delete an organization');
  });
});
