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
import { UsersOrganizationsRepository } from '@/domain/users/user-organizations.repository';
import { UsersRepository } from '@/domain/users/users.repository';
import { WalletsRepository } from '@/domain/wallets/wallets.repository';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import {
  UserOrganizationRole,
  UserOrganizationStatus,
} from '@/domain/users/entities/user-organization.entity';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const UserRoleKeys = getStringEnumKeys(UserOrganizationRole);
const UserOrgStatusKeys = getStringEnumKeys(UserOrganizationStatus);

describe('UserOrganizationsRepository', () => {
  let postgresDatabaseService: PostgresDatabaseService;
  let userOrgRepo: UsersOrganizationsRepository;

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

    const walletsRepo = new WalletsRepository(postgresDatabaseService);
    userOrgRepo = new UsersOrganizationsRepository(
      postgresDatabaseService,
      new UsersRepository(postgresDatabaseService, walletsRepo),
      new OrganizationsRepository(postgresDatabaseService),
      walletsRepo,
    );
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

      const dbUserRepo = dataSource.getRepository(User);
      const dbOrgRepo = dataSource.getRepository(Organization);
      const dbUserOrgRepo = dataSource.getRepository(UserOrganization);
      const user = await dbUserRepo.insert({
        status: 'PENDING',
      });
      const org = await dbOrgRepo.insert({
        name: faker.word.noun(),
        status: 'ACTIVE',
      });
      const userOrg = await dbUserOrgRepo.insert({
        user: user.generatedMaps[0],
        organization: org.generatedMaps[0],
        status: faker.helpers.arrayElement(UserOrgStatusKeys),
        role: faker.helpers.arrayElement(UserRoleKeys),
      });

      const after = new Date().getTime();

      const createdAt = userOrg.generatedMaps[0].createdAt;
      const updatedAt = userOrg.generatedMaps[0].updatedAt;

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
      const dbUserRepo = dataSource.getRepository(User);
      const dbOrgRepo = dataSource.getRepository(Organization);
      const dbUserOrgRepo = dataSource.getRepository(UserOrganization);
      const user = await dbUserRepo.insert({
        status: 'PENDING',
      });
      const org = await dbOrgRepo.insert({
        name: faker.word.noun(),
        status: 'ACTIVE',
      });
      const prevUserOrg = await dbUserOrgRepo.insert({
        user: user.generatedMaps[0],
        organization: org.generatedMaps[0],
        status: 'ACTIVE',
        role: faker.helpers.arrayElement(UserRoleKeys),
      });

      const userOrgId = prevUserOrg.identifiers[0].id as User['id'];
      await dbUserOrgRepo.update(userOrgId, {
        status: 'DECLINED',
      });
      const updatedUserOrg = await dbUserOrgRepo.findOneOrFail({
        where: { id: userOrgId },
      });

      const prevUpdatedAt = prevUserOrg.generatedMaps[0].updatedAt;

      if (!(prevUpdatedAt instanceof Date)) {
        throw new Error('prevUpdatedAt is not a Date');
      }

      const updatedAtTime = updatedUserOrg.updatedAt.getTime();

      expect(updatedUserOrg.createdAt.getTime()).toBeLessThan(updatedAtTime);
      expect(prevUpdatedAt.getTime()).toBeLessThanOrEqual(updatedAtTime);
    });
  });

  describe('findOneOrFail', () => {
    it.todo('should find a user organization');

    it.todo('should throw an error if the user organization does not exist');
  });

  describe('findOne', () => {
    it.todo('should find a user organization');

    it.todo('should return null if the user organization does not exist');
  });

  describe('findOrFail', () => {
    it.todo('should find user organizations');

    it.todo('should throw an error if user organizations do not exist');
  });

  describe('find', () => {
    it.todo('should find user organizations');

    it.todo('should return an empty array if user organizations do not exist');
  });

  describe('inviteUsers', () => {
    it.todo(
      'should invite users to an organization and return the user organizations',
    );

    it.todo('should throw an error if the signer_address does not exist');

    it.todo('should throw if the signer_address has no user');

    it.todo('should throw an error if the organization does not exist');

    it.todo('should throw an error if the signer_address is not ACTIVE');

    it.todo('should create PENDING users for invitees that have no user');
  });

  describe('acceptInvite', () => {
    it.todo(
      'should accept an invite to an organization, setting the user organization and user to ACTIVE',
    );

    it.todo('should throw an error if the signer_address does not exist');

    it.todo('should throw if the signer_address has no user');

    it.todo('should throw an error if the organization does not exist');

    it.todo('should throw an error if the user organization is not INVITED');
  });

  describe('declineInvite', () => {
    it.todo(
      'should accept an invite to an organization, setting the user organization to DECLINED',
    );

    it.todo('should throw an error if the signer_address does not exist');

    it.todo('should throw if the signer_address has no user');

    it.todo('should throw an error if the organization does not exist');

    it.todo('should throw an error if the user organization is not INVITED');
  });

  describe('findAuthorizedUserOrgsOrFail', () => {
    it.todo('should find user organizations by organization id');

    it.todo('should throw an error if the signer_address does not exist');

    it.todo('should throw if the signer_address has no user');

    it.todo('should throw an error if the org does not exist');

    // Not sure if feasible
    it.todo(
      'should return an empty array if the org has no user organizations',
    );
  });

  describe('updateRole', () => {
    it.todo('should update the role of a user organization');

    it.todo('should throw an error if the signer_address does not exist');

    it.todo('should throw if the signer_address has no user');

    it.todo('should throw an error if the organization has no ACTIVE ADMINs');

    it.todo('should throw if the signer_address is not an ACTIVE ADMIN');

    it.todo('should throw an error if downgrading the last ACTIVE ADMIN');

    it.todo(
      'should throw an error if the user organization does not exist in the organization',
    );
  });

  describe('removeUser', () => {
    it.todo('should remove the user');

    it.todo('should throw an error if the signer_address does not exist');

    it.todo('should throw if the signer_address has no user');

    it.todo('should throw an error if the organization has no ACTIVE ADMINs');

    it.todo('should throw if the signer_address is not an ACTIVE ADMIN');

    it.todo('should throw an error if removing the last ACTIVE ADMIN');

    it.todo(
      'should throw an error if the user organization does not exist in the organization',
    );
  });
});
