import { faker } from '@faker-js/faker';
import { DataSource } from 'typeorm';
import { getAddress, maxUint256 } from 'viem';
import configuration from '@/config/entities/__tests__/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { User } from '@/datasources/users/entities/users.entity.db';
import { Wallet } from '@/datasources/wallets/entities/wallets.entity.db';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { Member } from '@/datasources/users/entities/member.entity.db';
import { Space } from '@/datasources/spaces/entities/space.entity.db';
import { SpaceSafe } from '@/datasources/spaces/entities/space-safes.entity.db';
import { SpaceSafesRepository } from '@/domain/spaces/space-safes.repository';
import { SpaceStatus } from '@/domain/spaces/entities/space.entity';
import type { Repository } from 'typeorm';
import type { ConfigService } from '@nestjs/config';
import type { ILoggingService } from '@/logging/logging.interface';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UniqueConstraintError } from '@/datasources/errors/unique-constraint-error';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const SpaceStatusKeys = getStringEnumKeys(SpaceStatus);

describe('SpaceSafesRepository', () => {
  let postgresDatabaseService: PostgresDatabaseService;
  let spaceSafesRepo: SpaceSafesRepository;
  let dbWalletRepo: Repository<Wallet>;
  let dbUserRepo: Repository<User>;
  let dbSpaceRepository: Repository<Space>;
  let dbMembersRepository: Repository<Member>;
  let dbSpaceSafesRepository: Repository<SpaceSafe>;

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

  const maxSafesPerSpace = 5;

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
        if (key === 'spaces.maxSafesPerSpace') {
          return maxSafesPerSpace;
        }
      }),
    } as jest.MockedObjectDeep<ConfigService>;
    const migrator = new DatabaseMigrator(
      mockLoggingService,
      postgresDatabaseService,
      mockConfigService,
    );
    await migrator.migrate();

    spaceSafesRepo = new SpaceSafesRepository(
      postgresDatabaseService,
      mockConfigService,
    );

    dbWalletRepo = dataSource.getRepository(Wallet);
    dbUserRepo = dataSource.getRepository(User);
    dbSpaceRepository = dataSource.getRepository(Space);
    dbMembersRepository = dataSource.getRepository(Member);
    dbSpaceSafesRepository = dataSource.getRepository(SpaceSafe);
  });

  afterEach(async () => {
    jest.resetAllMocks();

    await Promise.all(
      [
        dbWalletRepo,
        dbUserRepo,
        dbSpaceRepository,
        dbMembersRepository,
        dbSpaceSafesRepository,
      ].map(async (repo) => {
        await repo.createQueryBuilder().delete().where('1=1').execute();
      }),
    );
  });

  afterAll(async () => {
    await postgresDatabaseService.getDataSource().dropDatabase();
    await postgresDatabaseService.destroyDatabaseConnection();
  });

  // As the triggers are set on the database level, Jest's fake timers are not accurate
  describe('createdAt/updatedAt', () => {
    it('should set createdAt and updatedAt when creating a SpaceSafe', async () => {
      const before = new Date().getTime();
      const space = await dbSpaceRepository.insert({
        status: faker.helpers.arrayElement(SpaceStatusKeys),
        name: faker.word.noun(),
      });
      const spaceSafe = await dbSpaceSafesRepository.insert({
        chainId: faker.string.numeric(),
        address: getAddress(faker.finance.ethereumAddress()),
        space: space.identifiers[0].id,
      });

      const after = new Date().getTime();

      const createdAt = spaceSafe.generatedMaps[0].createdAt;
      const updatedAt = spaceSafe.generatedMaps[0].updatedAt;

      if (!(createdAt instanceof Date) || !(updatedAt instanceof Date)) {
        throw new Error('createdAt and/or updatedAt is not a Date');
      }

      expect(createdAt).toEqual(updatedAt);

      expect(createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(createdAt.getTime()).toBeLessThanOrEqual(after);

      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(updatedAt.getTime()).toBeLessThanOrEqual(after);
    });

    it('should update updatedAt when updating a SpaceSafe', async () => {
      const space = await dbSpaceRepository.insert({
        status: faker.helpers.arrayElement(getStringEnumKeys(SpaceStatus)),
        name: faker.word.noun(),
      });
      const prevSpaceSafe = await dbSpaceSafesRepository.insert({
        chainId: faker.string.numeric(),
        address: getAddress(faker.finance.ethereumAddress()),
        space: space.identifiers[0].id,
      });
      const spaceSafeId = prevSpaceSafe.identifiers[0].id as SpaceSafe['id'];
      await dbSpaceSafesRepository.update(spaceSafeId, {
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const updatedSpaceSafe = await dbSpaceSafesRepository.findOneOrFail({
        where: { id: spaceSafeId },
      });

      const prevUpdatedAt = prevSpaceSafe.generatedMaps[0].updatedAt;

      if (!(prevUpdatedAt instanceof Date)) {
        throw new Error('prevUpdatedAt is not a Date');
      }

      expect(prevUpdatedAt.getTime()).toBeLessThanOrEqual(
        updatedSpaceSafe.updatedAt.getTime(),
      );
    });
  });

  describe('chain_id', () => {
    it('should not allow a chain_id to be longer than uint256 (78 chars)', async () => {
      const space = await dbSpaceRepository.insert({
        status: faker.helpers.arrayElement(getStringEnumKeys(SpaceStatus)),
        name: faker.word.noun(),
      });
      await expect(
        dbSpaceSafesRepository.insert({
          chainId: (maxUint256 * BigInt(10)).toString(), // 79 chars
          address: getAddress(faker.finance.ethereumAddress()),
          space: space.identifiers[0].id,
        }),
      ).rejects.toThrow('value too long');
    });
  });

  describe('address', () => {
    it('should store non-checksummed addresses, checksummed', async () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const checksummedAddress = getAddress(nonChecksummedAddress);

      const space = await dbSpaceRepository.insert({
        status: faker.helpers.arrayElement(getStringEnumKeys(SpaceStatus)),
        name: faker.word.noun(),
      });
      const insertSpaceSafeResult = await dbSpaceSafesRepository.insert({
        chainId: faker.string.numeric(),
        address: nonChecksummedAddress as SpaceSafe['address'],
        space: space.identifiers[0].id,
      });
      const spaceSafe = await dbSpaceSafesRepository.findOneOrFail({
        where: {
          id: insertSpaceSafeResult.identifiers[0].id as SpaceSafe['id'],
        },
      });

      expect(spaceSafe.address).toEqual(checksummedAddress);
    });

    it('should update non-checksummed addresses, checksummed', async () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const checksummedAddress = getAddress(nonChecksummedAddress);

      const space = await dbSpaceRepository.insert({
        status: faker.helpers.arrayElement(getStringEnumKeys(SpaceStatus)),
        name: faker.word.noun(),
      });
      const insertSpaceSafeResult = await dbSpaceSafesRepository.insert({
        chainId: faker.string.numeric(),
        address: checksummedAddress,
        space: space.identifiers[0].id,
      });
      const insertedSpaceSafeId = insertSpaceSafeResult.identifiers[0]
        .id as SpaceSafe['id'];

      await dbSpaceSafesRepository.update(insertedSpaceSafeId, {
        address: nonChecksummedAddress as SpaceSafe['address'],
      });

      const spaceSafe = await dbSpaceSafesRepository.findOneOrFail({
        where: {
          id: insertedSpaceSafeId,
        },
      });

      expect(spaceSafe.address).toEqual(checksummedAddress);
    });
  });

  describe('create', () => {
    it('should create a SpaceSafe', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      const user = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const userId = user.identifiers[0].id as User['id'];
      await dbWalletRepo.insert({
        user: { id: userId },
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbSpaceRepository.insert({
        status: faker.helpers.arrayElement(getStringEnumKeys(SpaceStatus)),
        name: faker.word.noun(),
      });
      const spaceId = space.identifiers[0].id as Space['id'];
      await dbMembersRepository.insert({
        user: { id: userId },
        role: 'ADMIN',
        status: 'ACTIVE',
        name: faker.word.noun(),
        space: { id: spaceId },
      });

      await spaceSafesRepo.create({
        spaceId: spaceId,
        payload: [
          {
            chainId,
            address,
          },
        ],
      });

      await expect(
        dbSpaceSafesRepository.find({
          where: { chainId, address },
        }),
      ).resolves.toEqual([
        {
          id: expect.any(Number),
          chainId,
          address,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      ]);
    });

    it('should create multiple SpaceSafes', async () => {
      const payload = faker.helpers.multiple(
        () => ({
          chainId: faker.string.numeric(),
          address: getAddress(faker.finance.ethereumAddress()),
        }),
        { count: { min: 2, max: maxSafesPerSpace } },
      );
      const user = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const userId = user.identifiers[0].id as User['id'];
      await dbWalletRepo.insert({
        user: { id: userId },
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbSpaceRepository.insert({
        status: faker.helpers.arrayElement(getStringEnumKeys(SpaceStatus)),
        name: faker.word.noun(),
      });
      const spaceId = space.identifiers[0].id as Space['id'];
      await dbMembersRepository.insert({
        user: { id: userId },
        role: 'ADMIN',
        status: 'ACTIVE',
        name: faker.word.noun(),
        space: { id: spaceId },
      });

      await spaceSafesRepo.create({
        spaceId: spaceId,
        payload,
      });

      await expect(dbSpaceSafesRepository.find()).resolves.toEqual(
        payload.map(({ chainId, address }) => ({
          id: expect.any(Number),
          chainId,
          address,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })),
      );
    });

    it('should fail if the number of SpaceSafes surpasses the limit', async () => {
      const user = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const userId = user.identifiers[0].id as User['id'];
      await dbWalletRepo.insert({
        user: { id: userId },
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbSpaceRepository.insert({
        status: faker.helpers.arrayElement(getStringEnumKeys(SpaceStatus)),
        name: faker.word.noun(),
      });
      const spaceId = space.identifiers[0].id as Space['id'];
      await dbMembersRepository.insert({
        user: { id: userId },
        role: 'ADMIN',
        status: 'ACTIVE',
        name: faker.word.noun(),
        space: { id: spaceId },
      });

      // Create (maxSafesPerSpace - 1) Safes
      await spaceSafesRepo.create({
        spaceId: spaceId,
        payload: faker.helpers.multiple(
          () => ({
            chainId: faker.string.numeric(),
            address: getAddress(faker.finance.ethereumAddress()),
          }),
          { count: maxSafesPerSpace - 1 },
        ),
      });

      // Create 2 Safes more to surpass the limit
      await expect(
        spaceSafesRepo.create({
          spaceId: spaceId,
          payload: faker.helpers.multiple(
            () => ({
              chainId: faker.string.numeric(),
              address: getAddress(faker.finance.ethereumAddress()),
            }),
            { count: 2 },
          ),
        }),
      ).rejects.toThrow(
        new BadRequestException(
          `This Space only allows a maximum of ${maxSafesPerSpace} Safe Accounts. You can only add up to 1 more.`,
        ),
      );

      // The Space should still have (maxSafesPerSpace - 1) Safes
      await expect(spaceSafesRepo.findBySpaceId(spaceId)).resolves.toHaveLength(
        maxSafesPerSpace - 1,
      );
    });

    it('should fail if a SpaceSafe with the same address and chainId already exists', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      const user = await dbUserRepo.insert({
        status: 'ACTIVE',
      });
      const userId = user.identifiers[0].id as User['id'];
      await dbWalletRepo.insert({
        user: { id: userId },
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const space = await dbSpaceRepository.insert({
        status: faker.helpers.arrayElement(getStringEnumKeys(SpaceStatus)),
        name: faker.word.noun(),
      });
      const spaceId = space.identifiers[0].id as Space['id'];
      await dbMembersRepository.insert({
        user: { id: userId },
        role: 'ADMIN',
        status: 'ACTIVE',
        name: faker.word.noun(),
        space: { id: spaceId },
      });

      await expect(
        Promise.all([
          spaceSafesRepo.create({
            spaceId: spaceId,
            payload: [{ chainId, address }],
          }),
          spaceSafesRepo.create({
            spaceId: spaceId,
            payload: [
              { chainId, address },
              {
                chainId: faker.string.numeric(),
                address: getAddress(faker.finance.ethereumAddress()),
              },
            ],
          }),
        ]),
      ).rejects.toThrow(
        new UniqueConstraintError(
          `A SpaceSafe with the same chainId and address already exists: Key (chain_id, address, space_id)=(${chainId}, ${address}, ${spaceId}) already exists.`,
        ),
      );
    });
  });

  describe('findBySpaceId', () => {
    it('should return found space Safes', async () => {
      const spaceSafes = faker.helpers.multiple(
        () => ({
          chainId: faker.string.numeric(),
          address: getAddress(faker.finance.ethereumAddress()),
        }),
        { count: { min: 2, max: 5 } },
      );
      const space = await dbSpaceRepository.insert({
        status: faker.helpers.arrayElement(getStringEnumKeys(SpaceStatus)),
        name: faker.word.noun(),
      });
      const spaceId = space.identifiers[0].id as Space['id'];
      await Promise.all(
        spaceSafes.map(({ chainId, address }) => {
          return dbSpaceSafesRepository.insert({
            chainId,
            address,
            space: { id: spaceId },
          });
        }),
      );

      await expect(spaceSafesRepo.findBySpaceId(spaceId)).resolves.toEqual(
        expect.arrayContaining(spaceSafes),
      );
    });

    it('should return empty array if no space Safes found', async () => {
      await expect(
        spaceSafesRepo.findBySpaceId(
          faker.number.int({ max: DB_MAX_SAFE_INTEGER }),
        ),
      ).resolves.toEqual([]);
    });
  });

  describe('findOrFail', () => {
    it('should return found spaces Safes', async () => {
      const spaceSafes = faker.helpers.multiple(
        () => ({
          chainId: faker.string.numeric(),
          address: getAddress(faker.finance.ethereumAddress()),
        }),
        { count: { min: 2, max: 5 } },
      );
      const space = await dbSpaceRepository.insert({
        status: faker.helpers.arrayElement(getStringEnumKeys(SpaceStatus)),
        name: faker.word.noun(),
      });
      const spaceId = space.identifiers[0].id as Space['id'];
      await Promise.all(
        spaceSafes.map(({ chainId, address }) => {
          return dbSpaceSafesRepository.insert({
            chainId,
            address,
            space: { id: spaceId },
          });
        }),
      );

      await expect(
        spaceSafesRepo.findOrFail({
          where: { space: { id: spaceId } },
        }),
      ).resolves.toEqual(
        expect.arrayContaining(
          spaceSafes.map(({ chainId, address }) => ({
            id: expect.any(Number),
            chainId,
            address,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          })),
        ),
      );
    });

    it('should throw NotFoundException if no spaces Safes found', async () => {
      const space = await dbSpaceRepository.insert({
        status: faker.helpers.arrayElement(getStringEnumKeys(SpaceStatus)),
        name: faker.word.noun(),
      });
      const spaceId = space.identifiers[0].id as Space['id'];

      await expect(
        spaceSafesRepo.findOrFail({
          where: { space: { id: spaceId } },
        }),
      ).rejects.toThrow(new NotFoundException('Space has no Safes.'));
    });
  });

  describe('find', () => {
    it('should return found space Safes', async () => {
      const spaceSafes = faker.helpers.multiple(
        () => ({
          chainId: faker.string.numeric(),
          address: getAddress(faker.finance.ethereumAddress()),
        }),
        { count: { min: 2, max: 5 } },
      );
      const space = await dbSpaceRepository.insert({
        status: faker.helpers.arrayElement(getStringEnumKeys(SpaceStatus)),
        name: faker.word.noun(),
      });
      const spaceId = space.identifiers[0].id as Space['id'];
      await spaceSafesRepo.create({
        spaceId: spaceId,
        payload: spaceSafes,
      });

      await expect(
        spaceSafesRepo.find({
          where: { space: { id: spaceId } },
        }),
      ).resolves.toEqual(
        spaceSafes.map(({ chainId, address }) => ({
          id: expect.any(Number),
          chainId,
          address,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })),
      );
    });

    it('should return empty array if no space Safes found', async () => {
      const space = await dbSpaceRepository.insert({
        status: faker.helpers.arrayElement(getStringEnumKeys(SpaceStatus)),
        name: faker.word.noun(),
      });
      const spaceId = space.identifiers[0].id as Space['id'];

      expect(
        await spaceSafesRepo.find({
          where: { space: { id: spaceId } },
        }),
      ).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should delete a SpaceSafe', async () => {
      const space = await dbSpaceRepository.insert({
        status: faker.helpers.arrayElement(getStringEnumKeys(SpaceStatus)),
        name: faker.word.noun(),
      });
      const spaceId = space.identifiers[0].id as Space['id'];
      const spaceSafe = await dbSpaceSafesRepository.insert({
        chainId: faker.string.numeric(),
        address: getAddress(faker.finance.ethereumAddress()),
        space: {
          id: spaceId,
        },
      });
      const spaceSafeId = spaceSafe.identifiers[0].id as SpaceSafe['id'];

      const spaceSafeBefore = await spaceSafesRepo.findOrFail({
        where: { id: spaceSafeId },
      });

      await spaceSafesRepo.delete({
        spaceId: spaceId,
        payload: [
          {
            chainId: spaceSafeBefore[0].chainId,
            address: spaceSafeBefore[0].address,
          },
        ],
      });

      expect(spaceSafeBefore).toHaveLength(1);
      await expect(
        spaceSafesRepo.findOrFail({
          where: { space: { id: spaceId } },
        }),
      ).rejects.toThrow(new NotFoundException('Space has no Safes.'));
    });

    it('should delete multiple SpaceSafes', async () => {
      const spaceSafes = faker.helpers.multiple(
        () => ({
          chainId: faker.string.numeric(),
          address: getAddress(faker.finance.ethereumAddress()),
        }),
        { count: { min: 2, max: 5 } },
      );
      const space = await dbSpaceRepository.insert({
        status: faker.helpers.arrayElement(getStringEnumKeys(SpaceStatus)),
        name: faker.word.noun(),
      });
      const spaceId = space.identifiers[0].id as Space['id'];
      await spaceSafesRepo.create({
        spaceId: spaceId,
        payload: spaceSafes,
      });
      const spaceSafeBefore = await spaceSafesRepo.findBySpaceId(spaceId);

      await spaceSafesRepo.delete({
        spaceId: spaceId,
        payload: spaceSafes,
      });

      expect(spaceSafeBefore).toHaveLength(spaceSafes.length);
      await expect(
        spaceSafesRepo.findOrFail({
          where: { space: { id: spaceId } },
        }),
      ).rejects.toThrow(new NotFoundException('Space has no Safes.'));
    });

    it('should throw NotFoundException if provided SpaceSafe is not found', async () => {
      const space = await dbSpaceRepository.insert({
        status: faker.helpers.arrayElement(getStringEnumKeys(SpaceStatus)),
        name: faker.word.noun(),
      });
      const spaceId = space.identifiers[0].id as Space['id'];
      const chainId = faker.string.numeric();
      await dbSpaceSafesRepository.insert({
        chainId,
        address: getAddress(faker.finance.ethereumAddress()),
        space: {
          id: spaceId,
        },
      });

      await expect(
        spaceSafesRepo.delete({
          spaceId: spaceId,
          payload: [
            {
              chainId,
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        }),
      ).rejects.toThrow(new NotFoundException('Space has no Safes.'));
    });

    it('should throw NotFoundException if none of the provided SpaceSafes is found', async () => {
      const spaceSafes = faker.helpers.multiple(
        () => ({
          chainId: faker.string.numeric(),
          address: getAddress(faker.finance.ethereumAddress()),
        }),
        { count: { min: 2, max: 5 } },
      );
      const space = await dbSpaceRepository.insert({
        status: faker.helpers.arrayElement(getStringEnumKeys(SpaceStatus)),
        name: faker.word.noun(),
      });
      const spaceId = space.identifiers[0].id as Space['id'];
      await spaceSafesRepo.create({
        spaceId: spaceId,
        payload: spaceSafes,
      });

      const spaceSafeBefore = await spaceSafesRepo.findBySpaceId(spaceId);
      expect(spaceSafeBefore).toHaveLength(spaceSafes.length);

      // None is found
      await expect(
        spaceSafesRepo.delete({
          spaceId: spaceId,
          payload: [
            {
              chainId: faker.string.numeric(),
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        }),
      ).rejects.toThrow(new NotFoundException('Space has no Safes.'));
    });

    it('should delete found SpaceSafes and ignore not found', async () => {
      const spaceSafes = faker.helpers.multiple(
        () => ({
          chainId: faker.string.numeric(),
          address: getAddress(faker.finance.ethereumAddress()),
        }),
        { count: { min: 2, max: 5 } },
      );
      const space = await dbSpaceRepository.insert({
        status: faker.helpers.arrayElement(getStringEnumKeys(SpaceStatus)),
        name: faker.word.noun(),
      });
      const spaceId = space.identifiers[0].id as Space['id'];
      await spaceSafesRepo.create({
        spaceId: spaceId,
        payload: spaceSafes,
      });

      // Some are found
      await expect(
        spaceSafesRepo.delete({
          spaceId: spaceId,
          payload: [
            {
              chainId: spaceSafes[0].chainId,
              address: spaceSafes[0].address,
            },
            {
              chainId: faker.string.numeric(),
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        }),
      ).resolves.toBeUndefined();
    });
  });
});
