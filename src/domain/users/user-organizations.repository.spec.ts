import { faker } from '@faker-js/faker';
import { DataSource, In } from 'typeorm';
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
import { UserStatus } from '@/domain/users/entities/user.entity';
import { OrganizationStatus } from '@/domain/organizations/entities/organization.entity';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const UserStatusKeys = getStringEnumKeys(UserStatus);
const OrgStatusKeys = getStringEnumKeys(OrganizationStatus);
const UserOrgRoleKeys = getStringEnumKeys(UserOrganizationRole);
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

  const dbUserRepo = dataSource.getRepository(User);
  const dbUserOrgRepo = dataSource.getRepository(UserOrganization);
  const dbOrgRepo = dataSource.getRepository(Organization);

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
        role: faker.helpers.arrayElement(UserOrgRoleKeys),
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
        role: faker.helpers.arrayElement(UserOrgRoleKeys),
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
    it('should find a user organization', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const orgName = faker.word.noun();
      const orgStatus = faker.helpers.arrayElement(OrgStatusKeys);
      const userOrgName = faker.word.noun();
      const userOrgStatus = faker.helpers.arrayElement(UserOrgStatusKeys);
      const userOrgRole = faker.helpers.arrayElement(UserOrgRoleKeys);
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const org = await dbOrgRepo.insert({
        name: orgName,
        status: orgStatus,
      });
      const userOrg = await dbUserOrgRepo.insert({
        user: user.generatedMaps[0],
        organization: org.generatedMaps[0],
        name: userOrgName,
        status: userOrgStatus,
        role: userOrgRole,
      });
      const userOrgId = userOrg.identifiers[0].id as UserOrganization['id'];

      await expect(
        userOrgRepo.findOneOrFail({ id: userOrgId }),
      ).resolves.toEqual({
        createdAt: expect.any(Date),
        id: userOrgId,
        name: userOrgName,
        role: userOrgRole,
        status: userOrgStatus,
        updatedAt: expect.any(Date),
      });
    });

    it('should throw an error if the user organization does not exist', async () => {
      const userOrgId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        userOrgRepo.findOneOrFail({ id: userOrgId }),
      ).rejects.toThrow('User organization not found.');
    });
  });

  describe('findOne', () => {
    it('should find a user organization', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const orgName = faker.word.noun();
      const orgStatus = faker.helpers.arrayElement(OrgStatusKeys);
      const userOrgName = faker.word.noun();
      const userOrgStatus = faker.helpers.arrayElement(UserOrgStatusKeys);
      const userOrgRole = faker.helpers.arrayElement(UserOrgRoleKeys);
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const org = await dbOrgRepo.insert({
        name: orgName,
        status: orgStatus,
      });
      const userOrg = await dbUserOrgRepo.insert({
        user: user.generatedMaps[0],
        organization: org.generatedMaps[0],
        name: userOrgName,
        status: userOrgStatus,
        role: userOrgRole,
      });
      const userOrgId = userOrg.identifiers[0].id as UserOrganization['id'];

      await expect(userOrgRepo.findOne({ id: userOrgId })).resolves.toEqual({
        createdAt: expect.any(Date),
        id: userOrgId,
        name: userOrgName,
        role: userOrgRole,
        status: userOrgStatus,
        updatedAt: expect.any(Date),
      });
    });

    it('should return null if the user organization does not exist', async () => {
      const userOrgId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(userOrgRepo.findOne({ id: userOrgId })).resolves.toBeNull();
    });
  });

  describe('findOrFail', () => {
    it('should find user organizations', async () => {
      const userStatus1 = faker.helpers.arrayElement(UserStatusKeys);
      const userStatus2 = faker.helpers.arrayElement(UserStatusKeys);
      const orgName = faker.word.noun();
      const orgStatus = faker.helpers.arrayElement(OrgStatusKeys);
      const userOrgName1 = faker.word.noun();
      const userOrgName2 = faker.word.noun();
      const userOrgStatus1 = faker.helpers.arrayElement(UserOrgStatusKeys);
      const userOrgStatus2 = faker.helpers.arrayElement(UserOrgStatusKeys);
      const userOrgRole1 = faker.helpers.arrayElement(UserOrgRoleKeys);
      const userOrgRole2 = faker.helpers.arrayElement(UserOrgRoleKeys);
      const user1 = await dbUserRepo.insert({
        status: userStatus1,
      });
      const user2 = await dbUserRepo.insert({
        status: userStatus2,
      });
      const org = await dbOrgRepo.insert({
        name: orgName,
        status: orgStatus,
      });
      const userOrg1 = await dbUserOrgRepo.insert({
        user: user1.generatedMaps[0],
        organization: org.generatedMaps[0],
        name: userOrgName1,
        status: userOrgStatus1,
        role: userOrgRole1,
      });
      const userOrgId1 = userOrg1.identifiers[0].id as UserOrganization['id'];
      const userOrg2 = await dbUserOrgRepo.insert({
        user: user2.generatedMaps[0],
        organization: org.generatedMaps[0],
        name: userOrgName2,
        status: userOrgStatus2,
        role: userOrgRole2,
      });
      const userOrgId2 = userOrg2.identifiers[0].id as UserOrganization['id'];

      await expect(
        userOrgRepo.findOrFail({ where: { id: In([userOrgId1, userOrgId2]) } }),
      ).resolves.toEqual([
        {
          createdAt: expect.any(Date),
          id: userOrgId1,
          name: userOrgName1,
          role: userOrgRole1,
          status: userOrgStatus1,
          updatedAt: expect.any(Date),
        },
        {
          createdAt: expect.any(Date),
          id: userOrgId2,
          name: userOrgName2,
          role: userOrgRole2,
          status: userOrgStatus2,
          updatedAt: expect.any(Date),
        },
      ]);
    });

    it('should throw an error if user organizations do not exist', async () => {
      const userOrgId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        userOrgRepo.findOrFail({ where: { id: userOrgId } }),
      ).rejects.toThrow('No user organizations found.');
    });
  });

  describe('find', () => {
    it('should find user organizations', async () => {
      const userStatus1 = faker.helpers.arrayElement(UserStatusKeys);
      const userStatus2 = faker.helpers.arrayElement(UserStatusKeys);
      const orgName = faker.word.noun();
      const orgStatus = faker.helpers.arrayElement(OrgStatusKeys);
      const userOrgName1 = faker.word.noun();
      const userOrgName2 = faker.word.noun();
      const userOrgStatus1 = faker.helpers.arrayElement(UserOrgStatusKeys);
      const userOrgStatus2 = faker.helpers.arrayElement(UserOrgStatusKeys);
      const userOrgRole1 = faker.helpers.arrayElement(UserOrgRoleKeys);
      const userOrgRole2 = faker.helpers.arrayElement(UserOrgRoleKeys);
      const user1 = await dbUserRepo.insert({
        status: userStatus1,
      });
      const user2 = await dbUserRepo.insert({
        status: userStatus2,
      });
      const org = await dbOrgRepo.insert({
        name: orgName,
        status: orgStatus,
      });
      const userOrg1 = await dbUserOrgRepo.insert({
        user: user1.generatedMaps[0],
        organization: org.generatedMaps[0],
        name: userOrgName1,
        status: userOrgStatus1,
        role: userOrgRole1,
      });
      const userOrgId1 = userOrg1.identifiers[0].id as UserOrganization['id'];
      const userOrg2 = await dbUserOrgRepo.insert({
        user: user2.generatedMaps[0],
        organization: org.generatedMaps[0],
        name: userOrgName2,
        status: userOrgStatus2,
        role: userOrgRole2,
      });
      const userOrgId2 = userOrg2.identifiers[0].id as UserOrganization['id'];

      await expect(
        userOrgRepo.find({ where: { id: In([userOrgId1, userOrgId2]) } }),
      ).resolves.toEqual([
        {
          createdAt: expect.any(Date),
          id: userOrgId1,
          name: userOrgName1,
          role: userOrgRole1,
          status: userOrgStatus1,
          updatedAt: expect.any(Date),
        },
        {
          createdAt: expect.any(Date),
          id: userOrgId2,
          name: userOrgName2,
          role: userOrgRole2,
          status: userOrgStatus2,
          updatedAt: expect.any(Date),
        },
      ]);
    });

    it('should return an empty array if user organizations do not exist', async () => {
      const userOrgId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        userOrgRepo.find({ where: { id: userOrgId } }),
      ).resolves.toEqual([]);
    });
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
