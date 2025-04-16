import { faker } from '@faker-js/faker';
import { DataSource, EntityNotFoundError, In } from 'typeorm';
import configuration from '@/config/entities/__tests__/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { User } from '@/datasources/users/entities/users.entity.db';
import { Wallet } from '@/datasources/wallets/entities/wallets.entity.db';
import type { ConfigService } from '@nestjs/config';
import type { ILoggingService } from '@/logging/logging.interface';
import { Member } from '@/datasources/users/entities/member.entity.db';
import { Space } from '@/datasources/spaces/entities/space.entity.db';
import { SpacesRepository } from '@/domain/spaces/spaces.repository';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { UserStatus } from '@/domain/users/entities/user.entity';
import { SpaceStatus } from '@/domain/spaces/entities/space.entity';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { SpaceSafe } from '@/datasources/spaces/entities/space-safes.entity.db';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import type { IConfigurationService } from '@/config/configuration.service.interface';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;
const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

const UserStatusKeys = getStringEnumKeys(UserStatus);
const SpaceStatusKeys = getStringEnumKeys(SpaceStatus);

describe('SpacesRepository', () => {
  let postgresDatabaseService: PostgresDatabaseService;
  let spacesRepository: SpacesRepository;

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
    entities: [Member, Space, SpaceSafe, User, Wallet],
  });

  const dbUserRepo = dataSource.getRepository(User);
  const dbMembersRepository = dataSource.getRepository(Member);
  const dbSpacesRepository = dataSource.getRepository(Space);

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
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'spaces.maxSpaceCreationsPerUser') {
        return testConfiguration.spaces.maxSpaceCreationsPerUser;
      }
    });
    await migrator.migrate();
    spacesRepository = new SpacesRepository(
      postgresDatabaseService,
      mockConfigurationService,
    );
  });

  afterEach(async () => {
    jest.resetAllMocks();

    await Promise.all(
      [Member, Space, User, Wallet].map(async (entity) => {
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
    it('should set createdAt and updatedAt when creating a Space', async () => {
      const before = new Date().getTime();

      const space = await dbSpacesRepository.insert({
        name: faker.word.noun(),
        status: 'ACTIVE',
      });

      const after = new Date().getTime();

      const createdAt = space.generatedMaps[0].createdAt;
      const updatedAt = space.generatedMaps[0].updatedAt;

      if (!(createdAt instanceof Date) || !(updatedAt instanceof Date)) {
        throw new Error('createdAt and/or updatedAt is not a Date');
      }

      expect(createdAt).toEqual(updatedAt);

      expect(createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(createdAt.getTime()).toBeLessThanOrEqual(after);

      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(updatedAt.getTime()).toBeLessThanOrEqual(after);
    });

    it('should update updatedAt when updating a Space', async () => {
      const prevSpace = await dbSpacesRepository.insert({
        name: faker.word.noun(),
        status: 'ACTIVE',
      });
      const spaceId = prevSpace.identifiers[0].id as User['id'];
      await dbSpacesRepository.update(spaceId, {
        name: faker.word.noun(),
      });
      const updatedSpace = await dbSpacesRepository.findOneOrFail({
        where: { id: spaceId },
      });

      const prevUpdatedAt = prevSpace.generatedMaps[0].updatedAt;

      if (!(prevUpdatedAt instanceof Date)) {
        throw new Error('prevUpdatedAt is not a Date');
      }

      expect(prevUpdatedAt.getTime()).toBeLessThanOrEqual(
        updatedSpace.updatedAt.getTime(),
      );
    });
  });

  describe('create', () => {
    it('should create a space with an ACTIVE ADMIN user', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const name = faker.word.noun();
      const spaceStatus = faker.helpers.arrayElement(SpaceStatusKeys);
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const userId = user.identifiers[0].id as User['id'];

      const space = await spacesRepository.create({
        userId,
        name: name,
        status: spaceStatus,
      });

      expect(space).toEqual({
        id: expect.any(Number),
        name,
      });

      const dbMember = await dbMembersRepository.findOneOrFail({
        where: { user: { id: userId } },
        relations: {
          user: true,
          space: true,
        },
      });

      expect(dbMember).toEqual({
        id: expect.any(Number),
        role: 'ADMIN',
        status: 'ACTIVE',
        name: expect.any(String),
        invitedBy: null,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        user: {
          id: userId,
          status: userStatus,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
        space: {
          id: expect.any(Number),
          name,
          status: spaceStatus,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should fail if the MAX_SPACE_CREATIONS_PER_USER limit is reached', async () => {
      const config = jest.mocked({
        getOrThrow: jest.fn(),
      } as jest.MockedObjectDeep<IConfigurationService>);
      config.getOrThrow.mockImplementation((key) => {
        if (key === 'spaces.maxSpaceCreationsPerUser') return 1;
      });
      const target = new SpacesRepository(postgresDatabaseService, config);
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const name = faker.word.noun();
      const spaceStatus = faker.helpers.arrayElement(SpaceStatusKeys);
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const userId = user.identifiers[0].id as User['id'];

      await expect(
        target.create({
          userId,
          name: name,
          status: spaceStatus,
        }),
      ).resolves.toEqual({
        id: expect.any(Number),
        name,
      });

      // maxSpaceCreationsPerUser = 1
      await expect(
        target.create({
          userId,
          name: name,
          status: spaceStatus,
        }),
      ).rejects.toThrow();
    });

    it('should set the name of the space', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const spaceName = nameBuilder();
      const spaceStatus = faker.helpers.arrayElement(SpaceStatusKeys);
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const userId = user.identifiers[0].id as User['id'];

      const space = await spacesRepository.create({
        userId,
        name: spaceName,
        status: spaceStatus,
      });

      expect(space).toEqual({
        id: expect.any(Number),
        name: spaceName,
      });

      const dbMember = await dbMembersRepository.findOneOrFail({
        where: { user: { id: userId } },
        relations: {
          user: true,
          space: true,
        },
      });

      expect(dbMember).toEqual({
        id: expect.any(Number),
        role: 'ADMIN',
        status: 'ACTIVE',
        name: `${spaceName} creator`,
        invitedBy: null,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        user: {
          id: userId,
          status: userStatus,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
        space: {
          id: expect.any(Number),
          name: spaceName,
          status: spaceStatus,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should throw if the user does not exist', async () => {
      const spaceName = nameBuilder();
      const spaceStatus = faker.helpers.arrayElement(SpaceStatusKeys);
      const userId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        spacesRepository.create({
          userId,
          name: spaceName,
          status: spaceStatus,
        }),
      ).rejects.toThrow('Invalid enum key: undefined');
    });

    it('should not create any entries when an error occurs', async () => {
      const spaceName = nameBuilder();
      const spaceStatus = faker.helpers.arrayElement(SpaceStatusKeys);
      const userId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await spacesRepository
        .create({
          userId,
          name: spaceName,
          status: spaceStatus,
        })
        .catch(() => {});

      await expect(dbUserRepo.find()).resolves.toEqual([]);
      await expect(dbMembersRepository.find()).resolves.toEqual([]);
      await expect(dbSpacesRepository.find()).resolves.toEqual([]);
    });
  });

  describe('findOneOrFail', () => {
    it('should find a space', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const name = faker.word.noun();
      const spaceStatus = faker.helpers.arrayElement(SpaceStatusKeys);
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const userId = user.identifiers[0].id as User['id'];
      const space = await spacesRepository.create({
        userId,
        name: name,
        status: spaceStatus,
      });

      await expect(
        spacesRepository.findOneOrFail({ where: { id: space.id } }),
      ).resolves.toEqual({
        id: space.id,
        name,
        status: spaceStatus,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should throw an error if the space does not exist', async () => {
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        spacesRepository.findOneOrFail({ where: { id: spaceId } }),
      ).rejects.toThrow('Space not found.');
    });
  });

  describe('findOne', () => {
    it('should find a space', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const name = faker.word.noun();
      const spaceStatus = faker.helpers.arrayElement(SpaceStatusKeys);
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const userId = user.identifiers[0].id as User['id'];
      const space = await spacesRepository.create({
        userId,
        name: name,
        status: spaceStatus,
      });

      await expect(
        spacesRepository.findOne({ where: { id: space.id } }),
      ).resolves.toEqual({
        id: space.id,
        name,
        status: spaceStatus,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should return null if the space does not exist', async () => {
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        spacesRepository.findOne({ where: { id: spaceId } }),
      ).resolves.toBeNull();
    });
  });

  describe('findOrFail', () => {
    it('should find spaces', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const spaceName1 = nameBuilder();
      const spaceStatus1 = faker.helpers.arrayElement(SpaceStatusKeys);
      const spaceName2 = nameBuilder();
      const spaceStatus2 = faker.helpers.arrayElement(SpaceStatusKeys);
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const userId = user.identifiers[0].id as User['id'];
      const space1 = await spacesRepository.create({
        userId,
        name: spaceName1,
        status: spaceStatus1,
      });
      const space2 = await spacesRepository.create({
        userId,
        name: spaceName2,
        status: spaceStatus2,
      });

      await expect(
        spacesRepository.findOrFail({
          where: { id: In([space1.id, space2.id]) },
        }),
      ).resolves.toEqual([
        {
          id: space1.id,
          name: spaceName1,
          status: spaceStatus1,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
        {
          id: space2.id,
          name: spaceName2,
          status: spaceStatus2,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      ]);
    });

    it('should throw an error if spaces do not exist', async () => {
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        spacesRepository.findOrFail({ where: { id: spaceId } }),
      ).rejects.toThrow('Spaces not found.');
    });
  });

  describe('find', () => {
    it('should find spaces', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const spaceName1 = nameBuilder();
      const spaceStatus1 = faker.helpers.arrayElement(SpaceStatusKeys);
      const spaceName2 = nameBuilder();
      const spaceStatus2 = faker.helpers.arrayElement(SpaceStatusKeys);
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const userId = user.identifiers[0].id as User['id'];
      const space1 = await spacesRepository.create({
        userId,
        name: spaceName1,
        status: spaceStatus1,
      });
      const space2 = await spacesRepository.create({
        userId,
        name: spaceName2,
        status: spaceStatus2,
      });

      await expect(
        spacesRepository.find({
          where: {
            id: In([space1.id, space2.id]),
          },
        }),
      ).resolves.toEqual([
        {
          id: space1.id,
          name: spaceName1,
          status: spaceStatus1,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
        {
          id: space2.id,
          name: spaceName2,
          status: spaceStatus2,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      ]);
    });

    it('should return an empty array if spaces do not exist', async () => {
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        spacesRepository.find({ where: { id: spaceId } }),
      ).resolves.toEqual([]);
    });
  });

  describe('findOneByUserId', () => {
    it('should find a space by user id', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const spaceName = nameBuilder();
      const spaceStatus = faker.helpers.arrayElement(SpaceStatusKeys);
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const userId = user.identifiers[0].id as User['id'];
      const space = await spacesRepository.create({
        userId,
        name: spaceName,
        status: spaceStatus,
      });

      await expect(
        spacesRepository.findOneByUserIdOrFail({
          userId,
        }),
      ).resolves.toEqual({
        id: space.id,
        name: spaceName,
        status: spaceStatus,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should throw an error if the space does not exist', async () => {
      const userId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        spacesRepository.findOneByUserIdOrFail({ userId }),
      ).rejects.toThrow(`Space not found. UserId = ${userId}`);
    });
  });

  describe('findOneByUserId', () => {
    it('should find a space by user id', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const spaceName = nameBuilder();
      const spaceStatus = faker.helpers.arrayElement(SpaceStatusKeys);
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const userId = user.identifiers[0].id as User['id'];
      const space = await spacesRepository.create({
        userId,
        name: spaceName,
        status: spaceStatus,
      });

      await expect(
        spacesRepository.findOneByUserId({
          userId,
        }),
      ).resolves.toEqual({
        id: space.id,
        name: spaceName,
        status: spaceStatus,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should return null if the space does not exist', async () => {
      const userId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await expect(
        spacesRepository.findOneByUserId({ userId }),
      ).resolves.toBeNull();
    });
  });

  describe('update', () => {
    it('should update a space', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const spaceName = nameBuilder();
      const spaceStatus = faker.helpers.arrayElement(SpaceStatusKeys);
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const userId = user.identifiers[0].id as User['id'];
      const space = await spacesRepository.create({
        userId,
        name: spaceName,
        status: spaceStatus,
      });

      const newName = faker.word.noun();
      const newStatus = faker.helpers.arrayElement(SpaceStatusKeys);

      await spacesRepository.update({
        id: space.id,
        updatePayload: { name: newName, status: newStatus },
      });

      const dbSpace = await dbSpacesRepository.findOneOrFail({
        where: { id: space.id },
      });

      expect(dbSpace).toEqual({
        id: space.id,
        name: newName,
        status: newStatus,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('delete', () => {
    it('should delete a space', async () => {
      const userStatus = faker.helpers.arrayElement(UserStatusKeys);
      const spaceName = nameBuilder();
      const spaceStatus = faker.helpers.arrayElement(SpaceStatusKeys);
      const user = await dbUserRepo.insert({
        status: userStatus,
      });
      const userId = user.identifiers[0].id as User['id'];
      const space = await spacesRepository.create({
        userId,
        name: spaceName,
        status: spaceStatus,
      });

      await spacesRepository.delete(space.id);

      await expect(
        dbSpacesRepository.findOneOrFail({ where: { id: space.id } }),
      ).rejects.toBeInstanceOf(EntityNotFoundError);
    });
  });
});
