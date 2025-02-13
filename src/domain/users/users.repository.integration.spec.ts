import { faker } from '@faker-js/faker';
import { DataSource } from 'typeorm';
import { getAddress } from 'viem';
import configuration from '@/config/entities/__tests__/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { User } from '@/datasources/users/entities/users.entity.db';
import { UsersRepository } from '@/domain/users/users.repository';
import { WalletsRepository } from '@/domain/wallets/wallets.repository';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { UserStatus } from '@/domain/users/entities/user.entity';
import { Wallet } from '@/datasources/wallets/entities/wallets.entity.db';
import type { ConfigService } from '@nestjs/config';
import type { ILoggingService } from '@/logging/logging.interface';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

// TODO: User enum keys once user orgs is merged
const UserStatusKeys = ['ACTIVE', 'PENDING'] as const;

describe('UsersRepository', () => {
  let postgresDatabaseService: PostgresDatabaseService;
  let usersRepository: UsersRepository;

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

    usersRepository = new UsersRepository(
      postgresDatabaseService,
      new WalletsRepository(postgresDatabaseService),
    );
  });

  afterEach(async () => {
    jest.resetAllMocks();

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
  describe('created_at/updated_at', () => {
    it('should set created_at and updated_at when creating a User', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const before = new Date().getTime();
      const user = await dbUserRepository.insert({
        status: faker.helpers.arrayElement(UserStatusKeys),
      });

      const after = new Date().getTime();

      const createdAt = user.generatedMaps[0].created_at;
      const updatedAt = user.generatedMaps[0].updated_at;

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

    it('should update updated_at when updating a User', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const prevUser = await dbUserRepository.insert({
        status: 'PENDING',
      });
      const userId = prevUser.identifiers[0].id as User['id'];
      await dbUserRepository.update(userId, {
        status: 'ACTIVE',
      });
      const updatedUser = await dbUserRepository.findOneOrFail({
        where: { id: userId },
      });

      const prevUpdatedAt = prevUser.generatedMaps[0].updated_at;

      if (!(prevUpdatedAt instanceof Date)) {
        throw new Error('prevUpdatedAt is not a Date');
      }

      const updatedAtTime = updatedUser.updated_at.getTime();

      expect(updatedUser.created_at.getTime()).toBeLessThan(updatedAtTime);
      expect(prevUpdatedAt.getTime()).toBeLessThanOrEqual(updatedAtTime);
    });
  });

  describe('createWithWallet', () => {
    it('should insert a new user and a linked wallet', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.arrayElement(UserStatusKeys);

      await usersRepository.createWithWallet({ status, authPayload });

      const wallet = await dbWalletRepository.findOneOrFail({
        where: { address: authPayload.signer_address },
        relations: { user: true },
      });

      expect(wallet).toStrictEqual(
        expect.objectContaining({
          address: authPayload.signer_address,
          created_at: expect.any(Date),
          id: wallet.id,
          updated_at: expect.any(Date),
          user: expect.objectContaining({
            created_at: expect.any(Date),
            id: wallet.user.id,
            status,
            updated_at: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw an error if the wallet already exists', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.arrayElement(UserStatusKeys);

      await usersRepository.createWithWallet({ status, authPayload });

      await expect(
        usersRepository.createWithWallet({ status, authPayload }),
      ).rejects.toThrow(
        `A wallet with the same address already exists. Wallet=${authPayload.signer_address}`,
      );
    });

    it('should throw if an incorrect UserStatus is provided', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.string.alpha() as unknown as keyof typeof UserStatus;

      await expect(
        usersRepository.createWithWallet({ status, authPayload }),
      ).rejects.toThrow(`invalid input syntax for type integer: "${status}"`);
    });

    it('should throw if an invalid wallet address is provided', async () => {
      const signerAddress = faker.string.hexadecimal({
        length: { min: 41, max: 41 },
      });
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', signerAddress as `0x${string}`)
        .build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.arrayElement(UserStatusKeys);

      await expect(
        usersRepository.createWithWallet({ status, authPayload }),
      ).rejects.toThrow(new RegExp(`^Address "${signerAddress}" is invalid.`));
    });

    it('should checksum the inserted wallet address', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', nonChecksummedAddress as `0x${string}`)
        .build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.arrayElement(UserStatusKeys);

      await usersRepository.createWithWallet({ status, authPayload });

      const wallet = await dbWalletRepository.findOneOrFail({
        where: { address: authPayload.signer_address },
      });

      expect(wallet).toStrictEqual(
        expect.objectContaining({
          address: getAddress(nonChecksummedAddress),
        }),
      );
    });
  });

  describe('create', () => {
    it('should insert a new user', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const status = faker.helpers.arrayElement(UserStatusKeys);

      await postgresDatabaseService.transaction(async (entityManager) => {
        await usersRepository.create(status, entityManager);
      });

      const users = await dbUserRepository.find();

      expect(users).toStrictEqual([
        expect.objectContaining({
          created_at: expect.any(Date),
          id: users[0].id,
          status,
          updated_at: expect.any(Date),
        }),
      ]);
    });

    it('should throw if an incorrect UserStatus is provided', async () => {
      const status = faker.string.alpha() as unknown as keyof typeof UserStatus;

      await expect(
        postgresDatabaseService.transaction(async (entityManager) => {
          await usersRepository.create(status, entityManager);
        }),
      ).rejects.toThrow(`invalid input syntax for type integer: "${status}"`);
    });
  });

  describe('getWithWallets', () => {
    it('should return a user with their wallets', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.arrayElement(UserStatusKeys);
      const userInsertResult = await dbUserRepository.insert({
        status,
      });
      await dbWalletRepository.insert({
        user: {
          id: userInsertResult.identifiers[0].id,
        },
        address: authPayloadDto.signer_address,
      });
      const wallet = await dbWalletRepository.findOneOrFail({
        where: { address: authPayload.signer_address },
        relations: { user: true },
      });

      await expect(
        usersRepository.getWithWallets(authPayload),
      ).resolves.toEqual({
        id: wallet.user.id,
        status,
        wallets: [
          {
            id: wallet.id,
            address: authPayload.signer_address,
          },
        ],
      });
    });

    it('should throw if no user wallet is found', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.arrayElement(UserStatusKeys);
      await dbUserRepository.insert({ status });

      await expect(usersRepository.getWithWallets(authPayload)).rejects.toThrow(
        `Wallet not found. Address=${authPayload.signer_address}`,
      );
    });

    it('should find by non-checksummed address', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', nonChecksummedAddress as `0x${string}`)
        .build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.arrayElement(UserStatusKeys);
      const userInsertResult = await dbUserRepository.insert({
        status,
      });
      await dbWalletRepository.insert({
        user: {
          id: userInsertResult.identifiers[0].id,
        },
        address: authPayloadDto.signer_address,
      });
      const wallet = await dbWalletRepository.findOneOrFail({
        where: { address: getAddress(nonChecksummedAddress) },
        relations: { user: true },
      });

      await expect(
        usersRepository.getWithWallets(authPayload),
      ).resolves.toEqual({
        id: wallet.user.id,
        status,
        wallets: [
          {
            id: wallet.id,
            address: getAddress(nonChecksummedAddress),
          },
        ],
      });
    });
  });

  describe('addWalletToUser', () => {
    it('should add a wallet to a user', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.arrayElement(UserStatusKeys);
      const userInsertResult = await dbUserRepository.insert({
        status,
      });
      await dbWalletRepository.insert({
        user: {
          id: userInsertResult.identifiers[0].id,
        },
        address: authPayloadDto.signer_address,
      });

      await usersRepository.addWalletToUser({
        authPayload,
        walletAddress,
      });

      const wallet = await dbWalletRepository.findOneOrFail({
        where: { address: walletAddress },
        relations: { user: true },
      });
      expect(wallet).toStrictEqual(
        expect.objectContaining({
          address: walletAddress,
          created_at: expect.any(Date),
          id: wallet.id,
          updated_at: expect.any(Date),
          user: expect.objectContaining({
            created_at: expect.any(Date),
            id: wallet.user.id,
            status,
            updated_at: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw if the user wallet already exists', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.arrayElement(UserStatusKeys);
      const userInsertResult = await dbUserRepository.insert({
        status,
      });

      await dbWalletRepository.insert({
        user: {
          id: userInsertResult.identifiers[0].id,
        },
        address: authPayloadDto.signer_address,
      });

      await expect(
        usersRepository.addWalletToUser({
          authPayload,
          walletAddress: authPayloadDto.signer_address,
        }),
      ).rejects.toThrow(
        `A wallet with the same address already exists. Wallet=${authPayloadDto.signer_address}`,
      );
    });

    it('should throw if an invalid wallet address is provided', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const walletAddress = faker.string.hexadecimal({
        length: { min: 41, max: 41 },
      });
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.arrayElement(UserStatusKeys);
      await dbUserRepository.insert({ status });

      await expect(
        usersRepository.addWalletToUser({
          authPayload,
          walletAddress: walletAddress as `0x${string}`,
        }),
      ).rejects.toThrow(new RegExp(`^Address "${walletAddress}" is invalid.`));
    });

    it('should checksum the inserted wallet address', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.arrayElement(UserStatusKeys);
      const userInsertResult = await dbUserRepository.insert({
        status,
      });
      await dbWalletRepository.insert({
        user: {
          id: userInsertResult.identifiers[0].id,
        },
        address: authPayloadDto.signer_address,
      });

      await usersRepository.addWalletToUser({
        authPayload,
        walletAddress: nonChecksummedAddress as `0x${string}`,
      });

      const wallet = await dbWalletRepository.findOneOrFail({
        where: { address: getAddress(nonChecksummedAddress) },
        relations: { user: true },
      });
      expect(wallet).toStrictEqual(
        expect.objectContaining({
          address: getAddress(nonChecksummedAddress),
        }),
      );
    });
  });

  describe('delete', () => {
    it('should delete a user and their wallets', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.arrayElement(UserStatusKeys);
      const userInsertResult = await dbUserRepository.insert({
        status,
      });
      const userId = userInsertResult.identifiers[0].id;
      await dbWalletRepository.insert({
        user: {
          id: userId,
        },
        address: authPayloadDto.signer_address,
      });
      await dbWalletRepository.insert({
        user: {
          id: userId,
        },
        address: walletAddress,
      });
      await expect(dbWalletRepository.find()).resolves.toHaveLength(2);

      await usersRepository.delete(authPayload);

      await expect(dbUserRepository.find()).resolves.toEqual([]);
      await expect(dbWalletRepository.find()).resolves.toEqual([]);
    });

    it('should throw if no user wallet is found', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.arrayElement(UserStatusKeys);
      await dbUserRepository.insert({ status });

      await expect(usersRepository.delete(authPayload)).rejects.toThrow(
        `Wallet not found. Address=${authPayload.signer_address}`,
      );
    });
  });

  describe('deleteWalletFromUser', () => {
    it('should delete a wallet from a user', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.arrayElement(UserStatusKeys);
      const userInsertResult = await dbUserRepository.insert({
        status,
      });
      const userId = userInsertResult.identifiers[0].id;
      await dbWalletRepository.insert({
        user: {
          id: userId,
        },
        address: authPayloadDto.signer_address,
      });
      await dbWalletRepository.insert({
        user: {
          id: userId,
        },
        address: walletAddress,
      });
      await expect(dbWalletRepository.find()).resolves.toHaveLength(2);

      await usersRepository.deleteWalletFromUser({
        walletAddress,
        authPayload,
      });

      const wallets = await dbWalletRepository.find({
        relations: { user: true },
      });
      expect(wallets).toEqual([
        {
          address: authPayload.signer_address,
          created_at: expect.any(Date),
          id: wallets[0].id,
          updated_at: expect.any(Date),
          user: expect.objectContaining({
            created_at: expect.any(Date),
            id: wallets[0].user.id,
            status,
            updated_at: expect.any(Date),
          }),
        },
      ]);
    });

    it('should throw if no wallet is found', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.arrayElement(UserStatusKeys);
      const userInsertResult = await dbUserRepository.insert({
        status,
      });
      await dbWalletRepository.insert({
        user: {
          id: userInsertResult.identifiers[0].id,
        },
        address: authPayloadDto.signer_address,
      });

      await expect(
        usersRepository.deleteWalletFromUser({
          walletAddress,
          authPayload,
        }),
      ).rejects.toThrow('Wallet not found.');
    });
  });

  describe('findByWalletAddressOrFail', () => {
    it('should find a user by wallet address', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const address = getAddress(faker.finance.ethereumAddress());
      const status = faker.helpers.arrayElement(UserStatusKeys);
      const userInsertResult = await dbUserRepository.insert({
        status,
      });
      await dbWalletRepository.insert({
        user: {
          id: userInsertResult.identifiers[0].id,
        },
        address,
      });

      await expect(
        usersRepository.findByWalletAddressOrFail(address),
      ).resolves.toEqual({
        id: userInsertResult.identifiers[0].id,
        status,
      });
    });

    it('should throw if no user is found', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      await expect(
        usersRepository.findByWalletAddressOrFail(address),
      ).rejects.toThrow('User not found.');
    });
  });

  describe('findByWalletAddress', () => {
    it('should find a user by wallet address', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const address = getAddress(faker.finance.ethereumAddress());
      const status = faker.helpers.arrayElement(UserStatusKeys);
      const userInsertResult = await dbUserRepository.insert({
        status,
      });
      await dbWalletRepository.insert({
        user: {
          id: userInsertResult.identifiers[0].id,
        },
        address,
      });

      await expect(
        usersRepository.findByWalletAddressOrFail(address),
      ).resolves.toEqual({
        id: userInsertResult.identifiers[0].id,
        status,
      });
    });

    it('should return undefined if no user is found', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      await expect(
        usersRepository.findByWalletAddress(address),
      ).resolves.toBeUndefined();
    });
  });
});
