import type { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { AddressBookItem } from '@/datasources/spaces/entities/address-book-item.entity.db';
import { SpaceSafe } from '@/datasources/spaces/entities/space-safes.entity.db';
import { Space } from '@/datasources/spaces/entities/space.entity.db';
import { Member } from '@/datasources/users/entities/member.entity.db';
import { User } from '@/datasources/users/entities/users.entity.db';
import { Wallet } from '@/datasources/wallets/entities/wallets.entity.db';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { AddressBookItemsRepository } from '@/domain/spaces/address-books/address-book-items.repository';
import type { IAddressBookItemsRepository } from '@/domain/spaces/address-books/address-book-items.repository.interface';
import { SpacesRepository } from '@/domain/spaces/spaces.repository';
import { UsersRepository } from '@/domain/users/users.repository';
import { WalletsRepository } from '@/domain/wallets/wallets.repository';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker/.';
import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { range } from 'lodash';
import { DataSource } from 'typeorm';
import { getAddress } from 'viem';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

describe('AddressBookItemsRepository', () => {
  let dbService: PostgresDatabaseService;
  let addressBookItemsRepository: IAddressBookItemsRepository;

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
    entities: [Member, Space, SpaceSafe, User, Wallet, AddressBookItem],
  });

  const dbWalletRepo = dataSource.getRepository(Wallet);
  const dbUserRepo = dataSource.getRepository(User);
  const dbSpacesRepository = dataSource.getRepository(Space);
  const dbMembersRepository = dataSource.getRepository(Member);
  const dbAddressBookItemsRepository =
    dataSource.getRepository(AddressBookItem);

  beforeAll(async () => {
    // Create database
    const testDataSource = new DataSource({
      ...postgresConfig({
        ...testConfiguration.db.connection.postgres,
        type: 'postgres',
        database: 'postgres',
      }),
    });

    const testDbService = new PostgresDatabaseService(
      mockLoggingService,
      testDataSource,
    );
    await testDbService.initializeDatabaseConnection();
    await testDbService
      .getDataSource()
      .query(`CREATE DATABASE ${testDatabaseName}`);
    await testDbService.destroyDatabaseConnection();

    // Create database connection
    dbService = new PostgresDatabaseService(mockLoggingService, dataSource);
    await dbService.initializeDatabaseConnection();

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
      dbService,
      mockConfigService,
    );
    await migrator.migrate();

    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'spaces.maxSpaceCreationsPerUser') {
        return testConfiguration.spaces.maxSpaceCreationsPerUser;
      }
    });

    addressBookItemsRepository = new AddressBookItemsRepository(
      dbService,
      new SpacesRepository(dbService, mockConfigurationService),
      new UsersRepository(dbService, new WalletsRepository(dbService)),
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(async () => {
    await dbService.getDataSource().dropDatabase();
    await dbService.destroyDatabaseConnection();
  });

  describe('findAllBySpaceId', () => {
    it('should return an empty array if no address book items exist for the given Space ID', async () => {
      const { spaceId, authPayload } = await createSpaceAsAdmin();
      const result = await addressBookItemsRepository.findAllBySpaceId({
        authPayload,
        spaceId,
      });
      expect(result).toEqual([]);
    });

    it('should return an array of address book items for the given Space ID', async () => {
      const { spaceId, authPayload } = await createSpaceAsAdmin();
      const items = range(1, 5).map(() => ({
        chainIds: range(2, 5).map(() => faker.string.numeric()),
        address: getAddress(faker.finance.ethereumAddress()),
        name: nameBuilder(),
        space: { id: spaceId },
        createdBy: getAddress(faker.finance.ethereumAddress()),
        lastUpdatedBy: getAddress(faker.finance.ethereumAddress()),
      }));
      await Promise.all(
        items.map((item) => dbAddressBookItemsRepository.insert(item)),
      );

      const result = await addressBookItemsRepository.findAllBySpaceId({
        authPayload,
        spaceId,
      });

      expect(result).toHaveLength(items.length);
      expect(result).toEqual(
        expect.arrayContaining(
          items.map((item) =>
            expect.objectContaining({
              chainIds: item.chainIds,
              address: item.address,
              name: item.name,
              createdBy: item.createdBy,
              lastUpdatedBy: item.lastUpdatedBy,
            }),
          ),
        ),
      );
    });

    it('should return an array of address book items for the given Space ID for a Space Member', async () => {
      const { spaceId } = await createSpaceAsAdmin();
      const authPayload = await addMemberToSpaceWithStatus(spaceId, 'ACTIVE');
      const items = range(1, 5).map(() => ({
        chainIds: range(2, 5).map(() => faker.string.numeric()),
        address: getAddress(faker.finance.ethereumAddress()),
        name: nameBuilder(),
        space: { id: spaceId },
        createdBy: getAddress(faker.finance.ethereumAddress()),
        lastUpdatedBy: getAddress(faker.finance.ethereumAddress()),
      }));
      await Promise.all(
        items.map((item) => dbAddressBookItemsRepository.insert(item)),
      );

      const result = await addressBookItemsRepository.findAllBySpaceId({
        authPayload,
        spaceId,
      });

      expect(result).toHaveLength(items.length);
      expect(result).toEqual(
        expect.arrayContaining(
          items.map((item) =>
            expect.objectContaining({
              chainIds: item.chainIds,
              address: item.address,
              name: item.name,
              createdBy: item.createdBy,
              lastUpdatedBy: item.lastUpdatedBy,
            }),
          ),
        ),
      );
    });

    it('should return a NotFoundException if the space does not exist', async () => {
      const { authPayload } = await createUser();
      await expect(
        addressBookItemsRepository.findAllBySpaceId({
          authPayload,
          spaceId: faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }),
        }),
      ).rejects.toThrow(new NotFoundException('Space not found.'));
    });

    it('should throw an NotFoundException if the user is not a member', async () => {
      const { spaceId } = await createSpaceAsAdmin();
      const { authPayload } = await createUser();
      await expect(
        addressBookItemsRepository.findAllBySpaceId({
          authPayload,
          spaceId,
        }),
      ).rejects.toThrow(new NotFoundException('Space not found.'));
    });

    it('should throw an NotFoundException if the user declined the membership', async () => {
      const { spaceId } = await createSpaceAsAdmin();
      const authPayload = await addMemberToSpaceWithStatus(spaceId, 'DECLINED');
      await expect(
        addressBookItemsRepository.findAllBySpaceId({
          authPayload,
          spaceId,
        }),
      ).rejects.toThrow(new NotFoundException('Space not found.'));
    });
  });

  // Utility functions

  const createSpaceAsAdmin = async (): Promise<{
    spaceId: Space['id'];
    authPayload: AuthPayload;
  }> => {
    const { user, authPayload } = await createUser();
    const space = await dbSpacesRepository.insert({
      name: nameBuilder(),
      status: 'ACTIVE',
    });
    await dbMembersRepository.insert({
      user,
      space: space.generatedMaps[0],
      name: nameBuilder(),
      status: 'ACTIVE',
      role: 'ADMIN',
      invitedBy: getAddress(faker.finance.ethereumAddress()),
    });
    return { spaceId: space.generatedMaps[0].id, authPayload: authPayload };
  };

  const addMemberToSpaceWithStatus = async (
    spaceId: Space['id'],
    memberStatus: 'ACTIVE' | 'INVITED' | 'DECLINED',
  ): Promise<AuthPayload> => {
    const { user, authPayload } = await createUser();
    const space = await dbSpacesRepository.findOneBy({ id: spaceId });
    if (!space) throw new NotFoundException('Space not found.');
    await dbMembersRepository.insert({
      user,
      space,
      name: nameBuilder(),
      status: memberStatus,
      role: 'MEMBER',
      invitedBy: getAddress(faker.finance.ethereumAddress()),
    });
    return authPayload;
  };

  const createUser = async (): Promise<{
    user: User;
    authPayload: AuthPayload;
  }> => {
    const authPayload = new AuthPayload(authPayloadDtoBuilder().build());
    const user = await dbUserRepo.insert({
      status: 'ACTIVE',
    });
    await dbWalletRepo.insert({
      user: user.generatedMaps[0],
      address: authPayload.signer_address,
    });
    return { user: user.raw[0], authPayload };
  };
});
