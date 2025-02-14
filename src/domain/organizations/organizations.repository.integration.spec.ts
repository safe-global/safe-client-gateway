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
import { getStringEnumKeys } from '@/domain/common/utils/enum';
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

      expect(createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(createdAt.getTime()).toBeLessThanOrEqual(after);

      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(updatedAt.getTime()).toBeLessThanOrEqual(after);
    });

    it('should update updatedAt when updating a User', async () => {
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

      expect(prevUpdatedAt.getTime()).toBeLessThanOrEqual(
        updatedOrg.updatedAt.getTime(),
      );
    });
  });

  describe('create', () => {
    it('should create an organization with an ACTIVE ADMIN user', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const name = faker.word.noun();
      const orgStatus = faker.helpers.arrayElement(OrgStatusKeys);
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const userId = user.identifiers[0].id as User['id'];

      const org = await orgRepo.create({
        userId,
        name: name,
        status: orgStatus,
      });

      expect(org).toEqual({
        id: expect.any(Number),
        name,
      });

      const dbUser = await dbUserRepo.findOneOrFail({
        where: { id: userId },
      });
      const dbOrg = await dbOrgRepo.findOneOrFail({
        where: { id: org.id },
      });
      const dbUserOrg = await dbUserOrgRepo.findOneOrFail({
        where: { user: { id: userId } },
      });

      expect(dbUser).toEqual({
        id: userId,
        status: userStatus,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(dbOrg).toEqual({
        id: expect.any(Number),
        name,
        status: orgStatus,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(dbUserOrg).toEqual({
        id: expect.any(Number),
        role: 'ADMIN',
        status: 'ACTIVE',
        name,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should throw if the user does not exist', async () => {
      const orgName = faker.word.noun();
      const orgStatus = faker.helpers.arrayElement(OrgStatusKeys);
      const userId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        orgRepo.create({
          userId,
          name: orgName,
          status: orgStatus,
        }),
      ).rejects.toThrow(
        'null value in column "status" of relation "users" violates not-null constraint',
      );

      await expect(dbUserRepo.find()).resolves.toEqual([]);
      await expect(dbUserOrgRepo.find()).resolves.toEqual([]);
      await expect(dbOrgRepo.find()).resolves.toEqual([]);
    });
  });

  describe('findOneOrFail', () => {
    it('should find an organization', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const name = faker.word.noun();
      const orgStatus = faker.helpers.arrayElement(OrgStatusKeys);
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const userId = user.identifiers[0].id as User['id'];
      const org = await orgRepo.create({
        userId,
        name: name,
        status: orgStatus,
      });

      await expect(
        orgRepo.findOneOrFail({ where: { id: org.id } }),
      ).resolves.toEqual({
        id: org.id,
        name,
        status: orgStatus,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should throw an error if the organization does not exist', async () => {
      const orgId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        orgRepo.findOneOrFail({ where: { id: orgId } }),
      ).rejects.toThrow('Organization not found.');
    });
  });

  describe('findOne', () => {
    it('should find an organization', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const name = faker.word.noun();
      const orgStatus = faker.helpers.arrayElement(OrgStatusKeys);
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const userId = user.identifiers[0].id as User['id'];
      const org = await orgRepo.create({
        userId,
        name: name,
        status: orgStatus,
      });

      await expect(orgRepo.findOne({ where: { id: org.id } })).resolves.toEqual(
        {
          id: org.id,
          name,
          status: orgStatus,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      );
    });

    it('should return null if the organization does not exist', async () => {
      const orgId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        orgRepo.findOne({ where: { id: orgId } }),
      ).resolves.toBeNull();
    });
  });

  describe('findOrFail', () => {
    it('should find organizations', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const orgName1 = faker.word.noun();
      const orgStatus1 = faker.helpers.arrayElement(OrgStatusKeys);
      const orgName2 = faker.word.noun();
      const orgStatus2 = faker.helpers.arrayElement(OrgStatusKeys);
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const userId = user.identifiers[0].id as User['id'];
      const org1 = await orgRepo.create({
        userId,
        name: orgName1,
        status: orgStatus1,
      });
      const org2 = await orgRepo.create({
        userId,
        name: orgName2,
        status: orgStatus2,
      });

      await expect(
        orgRepo.findOrFail({ where: { id: In([org1.id, org2.id]) } }),
      ).resolves.toEqual([
        {
          id: org1.id,
          name: orgName1,
          status: orgStatus1,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
        {
          id: org2.id,
          name: orgName2,
          status: orgStatus2,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      ]);
    });

    it('should throw an error if organizations do not exist', async () => {
      const orgId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        orgRepo.findOrFail({ where: { id: orgId } }),
      ).rejects.toThrow('Organizations not found.');
    });
  });

  describe('find', () => {
    it('should find organizations', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const orgName1 = faker.word.noun();
      const orgStatus1 = faker.helpers.arrayElement(OrgStatusKeys);
      const orgName2 = faker.word.noun();
      const orgStatus2 = faker.helpers.arrayElement(OrgStatusKeys);
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const userId = user.identifiers[0].id as User['id'];
      const org1 = await orgRepo.create({
        userId,
        name: orgName1,
        status: orgStatus1,
      });
      const org2 = await orgRepo.create({
        userId,
        name: orgName2,
        status: orgStatus2,
      });

      await expect(
        orgRepo.find({
          where: {
            id: In([org1.id, org2.id]),
          },
        }),
      ).resolves.toEqual([
        {
          id: org1.id,
          name: orgName1,
          status: orgStatus1,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
        {
          id: org2.id,
          name: orgName2,
          status: orgStatus2,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      ]);
    });

    it('should return an empty array if organizations do not exist', async () => {
      const orgId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(orgRepo.find({ where: { id: orgId } })).resolves.toEqual([]);
    });
  });

  describe('findByUserIdOrFail', () => {
    it('should find organizations by user id', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const name = faker.word.noun();
      const orgStatus = faker.helpers.arrayElement(OrgStatusKeys);
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const userId = user.identifiers[0].id as User['id'];
      const org = await orgRepo.create({
        userId,
        name: name,
        status: orgStatus,
      });

      await expect(orgRepo.findByUserIdOrFail({ userId })).resolves.toEqual([
        {
          id: org.id,
          name,
          status: orgStatus,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      ]);
    });

    it('should throw an error if organizations do not exist', async () => {
      const userId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(orgRepo.findByUserIdOrFail({ userId })).rejects.toThrow(
        `Organizations not found. UserId = ${userId}`,
      );
    });
  });

  describe('findByUserId', () => {
    it('should find organizations by user id', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const orgName1 = faker.word.noun();
      const orgStatus1 = faker.helpers.arrayElement(OrgStatusKeys);
      const orgName2 = faker.word.noun();
      const orgStatus2 = faker.helpers.arrayElement(OrgStatusKeys);
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const userId = user.identifiers[0].id as User['id'];
      const org1 = await orgRepo.create({
        userId,
        name: orgName1,
        status: orgStatus1,
      });
      const org2 = await orgRepo.create({
        userId,
        name: orgName2,
        status: orgStatus2,
      });

      await expect(
        orgRepo.findByUserId({
          userId,
        }),
      ).resolves.toEqual([
        {
          id: org1.id,
          name: orgName1,
          status: orgStatus1,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
        {
          id: org2.id,
          name: orgName2,
          status: orgStatus2,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      ]);
    });

    it('should return an empty array if organizations do not exist', async () => {
      const userId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(orgRepo.findByUserId({ userId })).resolves.toEqual([]);
    });
  });

  describe('findOneByUserIdOrFail', () => {
    it('should find an organization by user id', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const orgName = faker.word.noun();
      const orgStatus = faker.helpers.arrayElement(OrgStatusKeys);
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const userId = user.identifiers[0].id as User['id'];
      const org = await orgRepo.create({
        userId,
        name: orgName,
        status: orgStatus,
      });

      await expect(
        orgRepo.findOneByUserIdOrFail({
          userId,
        }),
      ).resolves.toEqual({
        id: org.id,
        name: orgName,
        status: orgStatus,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should throw an error if the organization does not exist', async () => {
      const userId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(orgRepo.findOneByUserIdOrFail({ userId })).rejects.toThrow(
        `Organization not found. UserId = ${userId}`,
      );
    });
  });

  describe('findOneByUserId', () => {
    it('should find an organization by user id', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const orgName = faker.word.noun();
      const orgStatus = faker.helpers.arrayElement(OrgStatusKeys);
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const userId = user.identifiers[0].id as User['id'];
      const org = await orgRepo.create({
        userId,
        name: orgName,
        status: orgStatus,
      });

      await expect(
        orgRepo.findOneByUserId({
          userId,
        }),
      ).resolves.toEqual({
        id: org.id,
        name: orgName,
        status: orgStatus,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should return null if the organization does not exist', async () => {
      const userId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(orgRepo.findOneByUserId({ userId })).resolves.toBeNull();
    });
  });

  describe('update', () => {
    it('should update an organization', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const orgName = faker.word.noun();
      const orgStatus = faker.helpers.arrayElement(OrgStatusKeys);
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const userId = user.identifiers[0].id as User['id'];
      const org = await orgRepo.create({
        userId,
        name: orgName,
        status: orgStatus,
      });

      const newName = faker.word.noun();
      const newStatus = faker.helpers.arrayElement(OrgStatusKeys);

      await orgRepo.update({
        id: org.id,
        updatePayload: { name: newName, status: newStatus },
      });

      const dbOrg = await dbOrgRepo.findOneOrFail({
        where: { id: org.id },
      });

      expect(dbOrg).toEqual({
        id: org.id,
        name: newName,
        status: newStatus,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('delete', () => {
    it('should delete an organization', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const orgName = faker.word.noun();
      const orgStatus = faker.helpers.arrayElement(OrgStatusKeys);
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const userId = user.identifiers[0].id as User['id'];
      const org = await orgRepo.create({
        userId,
        name: orgName,
        status: orgStatus,
      });

      await orgRepo.delete(org.id);

      await expect(
        dbOrgRepo.findOne({ where: { id: org.id } }),
      ).resolves.toBeNull();
    });
  });
});
