import { faker } from '@faker-js/faker';
import { DataSource } from 'typeorm';
import { getAddress } from 'viem';
import configuration from '@/config/entities/__tests__/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { User } from '@/datasources/users/entities/users.entity.db';
import { WalletsRepository } from '@/domain/wallets/wallets.repository';
import { Wallet } from '@/datasources/wallets/entities/wallets.entity.db';
import { UserStatus } from '@/domain/users/entities/user.entity';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import type { ConfigService } from '@nestjs/config';
import type { ILoggingService } from '@/logging/logging.interface';
import { Member } from '@/datasources/users/entities/member.entity.db';
import { Space } from '@/datasources/spaces/entities/space.entity.db';
import { SpaceSafe } from '@/datasources/spaces/entities/space-safes.entity.db';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const UserStatusKeys = getStringEnumKeys(UserStatus);

describe('WalletsRepository', () => {
  let postgresDatabaseService: PostgresDatabaseService;
  let walletsRepository: WalletsRepository;

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

    walletsRepository = new WalletsRepository(postgresDatabaseService);
  });

  afterEach(async () => {
    jest.resetAllMocks();

    // Truncate tables
    const dbWalletRepository = dataSource.getRepository(Wallet);
    const dbUserRepository = dataSource.getRepository(User);
    await dbWalletRepository
      .createQueryBuilder()
      .delete()
      .where('1=1')
      .execute();
    await dbUserRepository.createQueryBuilder().delete().where('1=1').execute();
  });

  afterAll(async () => {
    await postgresDatabaseService.getDataSource().dropDatabase();
    await postgresDatabaseService.destroyDatabaseConnection();
  });

  // As the triggers are set on the database level, Jest's fake timers are not accurate
  describe('createdAt/updatedAt', () => {
    it('should set createdAt and updatedAt when creating a Wallet', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const before = new Date().getTime();
      const user = await dbUserRepository.insert({
        status: faker.helpers.arrayElement(UserStatusKeys),
      });
      const wallet = await dbWalletRepository.insert({
        address: getAddress(faker.finance.ethereumAddress()),
        user: {
          id: user.identifiers[0].id as User['id'],
        },
      });

      const after = new Date().getTime();

      const createdAt = wallet.generatedMaps[0].createdAt;
      const updatedAt = wallet.generatedMaps[0].updatedAt;

      if (!(createdAt instanceof Date) || !(updatedAt instanceof Date)) {
        throw new Error('createdAt and/or updatedAt is not a Date');
      }

      expect(createdAt).toEqual(updatedAt);

      if (!(createdAt instanceof Date) || !(updatedAt instanceof Date)) {
        throw new Error('createdAt and/or updatedAt is not a Date');
      }

      expect(createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(createdAt.getTime()).toBeLessThanOrEqual(after);

      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(updatedAt.getTime()).toBeLessThanOrEqual(after);
    });

    it('should update updatedAt when updating a Wallet', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const user = await dbUserRepository.insert({
        status: faker.helpers.arrayElement(UserStatusKeys),
      });
      const prevWallet = await dbWalletRepository.insert({
        address: getAddress(faker.finance.ethereumAddress()),
        user: {
          id: user.identifiers[0].id as User['id'],
        },
      });
      const walletId = prevWallet.identifiers[0].id as Wallet['id'];
      await dbWalletRepository.update(walletId, {
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const updatedWallet = await dbWalletRepository.findOneOrFail({
        where: { id: walletId },
      });

      const prevUpdatedAt = prevWallet.generatedMaps[0].updatedAt;

      if (!(prevUpdatedAt instanceof Date)) {
        throw new Error('prevUpdatedAt is not a Date');
      }

      expect(prevUpdatedAt.getTime()).toBeLessThanOrEqual(
        updatedWallet.updatedAt.getTime(),
      );
    });
  });

  describe('findOneOrFail', () => {
    it('should find a wallet', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const address = getAddress(faker.finance.ethereumAddress());
      const user = await dbUserRepository.insert({
        status: faker.helpers.arrayElement(UserStatusKeys),
      });
      await dbWalletRepository.insert({
        address,
        user: {
          id: user.identifiers[0].id as User['id'],
        },
      });

      const wallet = await walletsRepository.findOneOrFail({});

      expect(wallet).toEqual({
        address,
        createdAt: expect.any(Date),
        id: wallet.id,
        updatedAt: expect.any(Date),
      });
    });

    it('should throw an error if wallet is not found', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      await expect(
        walletsRepository.findOneOrFail({ address }),
      ).rejects.toThrow('Wallet not found.');
    });
  });

  describe('findOne', () => {
    it('should find a wallet', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const address = getAddress(faker.finance.ethereumAddress());
      const user = await dbUserRepository.insert({
        status: faker.helpers.arrayElement(UserStatusKeys),
      });
      await dbWalletRepository.insert({
        address,
        user: {
          id: user.identifiers[0].id as User['id'],
        },
      });

      const wallet = await walletsRepository.findOne({ address });

      // We need to either assert wallet or use a bang operator to tell TypeScript
      // that we are sure that wallet is not undefined. Throwing an error provides
      // a better error message than using a bang operator.
      if (!wallet) {
        throw new Error('Wallet not found.');
      }

      expect(wallet).toEqual({
        address,
        createdAt: expect.any(Date),
        id: wallet.id,
        updatedAt: expect.any(Date),
      });
    });

    it('should return null if wallet is not found', async () => {
      const wallet = await walletsRepository.findOne({});

      expect(wallet).toBeNull();
    });
  });

  describe('findOrFail', () => {
    it('should find wallets', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const address1 = getAddress(faker.finance.ethereumAddress());
      const address2 = getAddress(faker.finance.ethereumAddress());
      const user = await dbUserRepository.insert({
        status: faker.helpers.arrayElement(UserStatusKeys),
      });
      const userId = user.identifiers[0].id as User['id'];
      await dbWalletRepository.insert({
        address: address1,
        user: {
          id: userId,
        },
      });
      await dbWalletRepository.insert({
        address: address2,
        user: {
          id: userId,
        },
      });

      const wallets = await walletsRepository.findOrFail({ where: {} });

      expect(wallets).toEqual([
        {
          address: address1,
          createdAt: expect.any(Date),
          id: expect.any(Number),
          updatedAt: expect.any(Date),
        },
        {
          address: address2,
          createdAt: expect.any(Date),
          id: expect.any(Number),
          updatedAt: expect.any(Date),
        },
      ]);
    });

    it('should throw an error if no wallets are found', async () => {
      await expect(walletsRepository.findOrFail({ where: {} })).rejects.toThrow(
        'Wallets not found.',
      );
    });
  });

  describe('find', () => {
    it('should find wallets', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const address1 = getAddress(faker.finance.ethereumAddress());
      const address2 = getAddress(faker.finance.ethereumAddress());
      const user = await dbUserRepository.insert({
        status: faker.helpers.arrayElement(UserStatusKeys),
      });
      const userId = user.identifiers[0].id as User['id'];
      await dbWalletRepository.insert({
        address: address1,
        user: { id: userId },
      });
      await dbWalletRepository.insert({
        address: address2,
        user: { id: userId },
      });

      const wallets = await walletsRepository.find({ where: {} });

      expect(wallets).toEqual([
        {
          address: address1,
          createdAt: expect.any(Date),
          id: expect.any(Number),
          updatedAt: expect.any(Date),
        },
        {
          address: address2,
          createdAt: expect.any(Date),
          id: expect.any(Number),
          updatedAt: expect.any(Date),
        },
      ]);
    });

    it('should return an empty array if no wallets are found', async () => {
      await expect(walletsRepository.find({ where: {} })).resolves.toEqual([]);
    });
  });

  describe('findOneByAddressOrFail', () => {
    it('should find a wallet by address', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const address = getAddress(faker.finance.ethereumAddress());
      const user = await dbUserRepository.insert({
        status: faker.helpers.arrayElement(UserStatusKeys),
      });
      await dbWalletRepository.insert({
        address,
        user: {
          id: user.identifiers[0].id as User['id'],
        },
      });

      const wallet = await walletsRepository.findOneByAddressOrFail(address);

      expect(wallet).toEqual({
        address,
        createdAt: expect.any(Date),
        id: expect.any(Number),
        updatedAt: expect.any(Date),
      });
    });

    it('should find a wallet by non-checksummed address', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase() as `0x${string}`;
      const user = await dbUserRepository.insert({
        status: faker.helpers.arrayElement(UserStatusKeys),
      });
      await dbWalletRepository.insert({
        address: nonChecksummedAddress,
        user: {
          id: user.identifiers[0].id as User['id'],
        },
      });

      const wallet = await walletsRepository.findOneByAddressOrFail(
        nonChecksummedAddress,
      );

      expect(wallet).toEqual({
        address: getAddress(nonChecksummedAddress),
        createdAt: expect.any(Date),
        id: expect.any(Number),
        updatedAt: expect.any(Date),
      });
    });

    it('should throw an error if wallet is not found', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      await expect(
        walletsRepository.findOneByAddressOrFail(address),
      ).rejects.toThrow(`Wallet not found. Address=${address}`);
    });
  });

  describe('findOneByAddress', () => {
    it('should find a wallet by address', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const address = getAddress(faker.finance.ethereumAddress());
      const user = await dbUserRepository.insert({
        status: faker.helpers.arrayElement(UserStatusKeys),
      });
      await dbWalletRepository.insert({
        address,
        user: {
          id: user.identifiers[0].id as User['id'],
        },
      });

      const wallet = await walletsRepository.findOneByAddress(address);

      expect(wallet).toEqual({
        address,
        createdAt: expect.any(Date),
        id: expect.any(Number),
        updatedAt: expect.any(Date),
      });
    });

    it('should find a wallet by non-checksummed address', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase() as `0x${string}`;
      const user = await dbUserRepository.insert({
        status: faker.helpers.arrayElement(UserStatusKeys),
      });
      await dbWalletRepository.insert({
        address: nonChecksummedAddress,
        user: {
          id: user.identifiers[0].id as User['id'],
        },
      });

      const wallet = await walletsRepository.findOneByAddress(
        nonChecksummedAddress,
      );

      expect(wallet).toEqual({
        address: getAddress(nonChecksummedAddress),
        createdAt: expect.any(Date),
        id: expect.any(Number),
        updatedAt: expect.any(Date),
      });
    });

    it('should return null if wallet is not found', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      const wallet = await walletsRepository.findOneByAddress(address);

      expect(wallet).toBeNull();
    });
  });

  describe('findByUser', () => {
    it('should find wallets by user', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const status = faker.helpers.arrayElement(UserStatusKeys);

      const address1 = getAddress(faker.finance.ethereumAddress());
      const address2 = getAddress(faker.finance.ethereumAddress());
      const user = await dbUserRepository.insert({ status });
      const userId = user.identifiers[0].id as User['id'];
      await dbWalletRepository.insert({
        address: address1,
        user: { id: userId },
      });
      await dbWalletRepository.insert({
        address: address2,
        user: { id: userId },
      });

      const wallets = await walletsRepository.findByUser(userId);

      expect(wallets).toEqual([
        {
          address: address1,
          createdAt: expect.any(Date),
          id: expect.any(Number),
          updatedAt: expect.any(Date),
        },
        {
          address: address2,
          createdAt: expect.any(Date),
          id: expect.any(Number),
          updatedAt: expect.any(Date),
        },
      ]);
    });

    it('should throw an error if invalid user ID is provided', async () => {
      const userId = faker.string.alpha() as unknown as User['id'];

      await expect(walletsRepository.findByUser(userId)).rejects.toThrow(
        `invalid input syntax for type integer: "${userId}"`,
      );
    });

    it('should return an empty array if no wallets are found', async () => {
      const userRepository = dataSource.getRepository(User);
      const user = await userRepository.insert({
        status: faker.helpers.arrayElement(UserStatusKeys),
      });

      const wallets = await walletsRepository.findByUser(
        user.identifiers[0].id as User['id'],
      );

      expect(wallets).toEqual([]);
    });
  });

  describe('create', () => {
    it('should create a wallet', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const walletAddress = getAddress(faker.finance.ethereumAddress());

      await postgresDatabaseService.transaction(async (entityManager) => {
        const user = await entityManager.getRepository(User).insert({
          status: faker.helpers.arrayElement(UserStatusKeys),
        });
        await walletsRepository.create(
          {
            userId: user.identifiers[0].id as User['id'],
            walletAddress,
          },
          entityManager,
        );
      });

      await expect(
        dbWalletRepository.find({ where: { address: walletAddress } }),
      ).resolves.toEqual([
        {
          address: walletAddress,
          createdAt: expect.any(Date),
          id: expect.any(Number),
          updatedAt: expect.any(Date),
        },
      ]);
    });

    it('should checksum the address before saving', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();

      await postgresDatabaseService.transaction(async (entityManager) => {
        const user = await entityManager.getRepository(User).insert({
          status: faker.helpers.arrayElement(UserStatusKeys),
        });
        await walletsRepository.create(
          {
            userId: user.identifiers[0].id as User['id'],
            walletAddress: nonChecksummedAddress as `0x${string}`,
          },
          entityManager,
        );
      });

      await expect(dbWalletRepository.find()).resolves.toEqual([
        {
          address: getAddress(nonChecksummedAddress),
          createdAt: expect.any(Date),
          id: expect.any(Number),
          updatedAt: expect.any(Date),
        },
      ]);
    });

    it('should throw an error if wallet with the same address already exists', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const user = await dbUserRepository.insert({
        status: faker.helpers.arrayElement(UserStatusKeys),
      });
      await dbWalletRepository.insert({
        address: walletAddress,
        user: {
          id: user.identifiers[0].id as User['id'],
        },
      });

      await expect(
        postgresDatabaseService.transaction(async (entityManager) => {
          const user = await entityManager.getRepository(User).insert({
            status: faker.helpers.arrayElement(UserStatusKeys),
          });
          await walletsRepository.create(
            {
              userId: user.identifiers[0].id as User['id'],
              walletAddress,
            },
            entityManager,
          );
        }),
      ).rejects.toThrow(
        'duplicate key value violates unique constraint "UQ_wallet_address"',
      );
    });

    it('should throw an error if non-existent user ID is provided', async () => {
      // Ensure not out of range for integer type
      const userId = faker.number.int({ max: 100 });
      const walletAddress = getAddress(faker.finance.ethereumAddress());

      await expect(
        postgresDatabaseService.transaction(async (entityManager) => {
          await walletsRepository.create(
            {
              userId,
              walletAddress,
            },
            entityManager,
          );
        }),
      ).rejects.toThrow(
        'insert or update on table "wallets" violates foreign key constraint',
      );
    });

    it('should throw if invalid wallet address is provided', async () => {
      const walletAddress = faker.string.hexadecimal({
        length: { min: 41, max: 41 },
      });

      await expect(
        postgresDatabaseService.transaction(async (entityManager) => {
          const user = await entityManager.getRepository(User).insert({
            status: faker.helpers.arrayElement(UserStatusKeys),
          });
          await walletsRepository.create(
            {
              userId: user.identifiers[0].id as User['id'],
              walletAddress: walletAddress as `0x${string}`,
            },
            entityManager,
          );
        }),
      ).rejects.toThrow(new RegExp(`^Address "${walletAddress}" is invalid.`));
    });
  });

  describe('deleteByAddress', () => {
    it('should delete a wallet by address', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const address = getAddress(faker.finance.ethereumAddress());
      const user = await dbUserRepository.insert({
        status: faker.helpers.arrayElement(UserStatusKeys),
      });
      await dbWalletRepository.insert({
        address,
        user: {
          id: user.identifiers[0].id as User['id'],
        },
      });
      await expect(dbWalletRepository.find()).resolves.toHaveLength(1);

      await walletsRepository.deleteByAddress(address);

      await expect(dbWalletRepository.find()).resolves.toEqual([]);
    });

    it('should delete by non-checksummed address', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const user = await dbUserRepository.insert({
        status: faker.helpers.arrayElement(UserStatusKeys),
      });
      await dbWalletRepository.insert({
        address: getAddress(nonChecksummedAddress),
        user: {
          id: user.identifiers[0].id as User['id'],
        },
      });

      await walletsRepository.deleteByAddress(
        nonChecksummedAddress as `0x${string}`,
      );

      await expect(dbWalletRepository.find()).resolves.toEqual([]);
    });

    it('should throw if providing invalid wallet address', async () => {
      const walletAddress = faker.string.hexadecimal({
        length: { min: 41, max: 41 },
      });

      await expect(
        walletsRepository.deleteByAddress(walletAddress as `0x${string}`),
      ).rejects.toThrow(new RegExp(`^Address "${walletAddress}" is invalid.`));
    });
  });
});
