// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { type Address, getAddress } from 'viem';
import configuration from '@/config/entities/__tests__/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import type { ILoggingService } from '@/logging/logging.interface';
import {
  oidcAuthPayloadDtoBuilder,
  siweAuthPayloadDtoBuilder,
} from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { SpaceSafe } from '@/modules/spaces/datasources/entities/space-safes.entity.db';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import { UserStatus } from '@/modules/users/domain/entities/user.entity';
import { UsersRepository } from '@/modules/users/domain/users.repository';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import { WalletsRepository } from '@/modules/wallets/domain/wallets.repository';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const UserStatusKeys = getStringEnumKeys(UserStatus);

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
  describe('createdAt/updatedAt', () => {
    it('should set createdAt and updatedAt when creating a User', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const before = Date.now();
      const user = await dbUserRepository.insert({
        status: faker.helpers.arrayElement(UserStatusKeys),
      });

      const after = Date.now();

      const createdAt = user.generatedMaps[0].createdAt;
      const updatedAt = user.generatedMaps[0].updatedAt;

      if (!(createdAt instanceof Date && updatedAt instanceof Date)) {
        throw new Error('createdAt and/or updatedAt is not a Date');
      }

      expect(createdAt).toEqual(updatedAt);

      expect(createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(createdAt.getTime()).toBeLessThanOrEqual(after);

      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(updatedAt.getTime()).toBeLessThanOrEqual(after);
    });

    it('should update updatedAt when updating a User', async () => {
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

      const prevUpdatedAt = prevUser.generatedMaps[0].updatedAt;

      if (!(prevUpdatedAt instanceof Date)) {
        throw new Error('prevUpdatedAt is not a Date');
      }

      expect(prevUpdatedAt.getTime()).toBeLessThanOrEqual(
        updatedUser.updatedAt.getTime(),
      );
    });
  });

  describe('findOneOrFail', () => {
    it('should return a user by ID', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const userInsertResult = await dbUserRepository.insert({
        status: 'ACTIVE',
      });
      const userId = userInsertResult.identifiers[0].id as number;

      const user = await usersRepository.findOneOrFail({ id: userId });

      expect(user.id).toBe(userId);
      expect(user.status).toBe('ACTIVE');
    });

    it('should throw NotFoundException for non-existent user', async () => {
      await expect(
        usersRepository.findOneOrFail({
          id: faker.number.int({ min: 999999, max: DB_MAX_SAFE_INTEGER }),
        }),
      ).rejects.toThrow(new NotFoundException('User not found.'));
    });
  });

  describe('createWithWallet', () => {
    it('should insert a new user and a linked wallet', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.arrayElement(UserStatusKeys);

      await usersRepository.createWithWallet({ status, authPayload });

      const wallet = await dbWalletRepository.findOneOrFail({
        where: { address: authPayload.signer_address },
        relations: { user: true },
      });

      expect(wallet).toEqual({
        address: authPayload.signer_address,
        createdAt: expect.any(Date),
        id: wallet.id,
        updatedAt: expect.any(Date),
        user: {
          createdAt: expect.any(Date),
          extUserId: null,
          id: wallet.user.id,
          status,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should throw an error if the wallet already exists', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
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
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.string.alpha() as unknown as keyof typeof UserStatus;

      await expect(
        usersRepository.createWithWallet({ status, authPayload }),
      ).rejects.toThrow(`Invalid enum key: ${status}`);
    });

    it('should throw if an invalid wallet address is provided', async () => {
      const signerAddress = faker.string.hexadecimal({
        length: { min: 41, max: 41 },
      });
      const authPayloadDto = siweAuthPayloadDtoBuilder()
        .with('signer_address', signerAddress as Address)
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
      const authPayloadDto = siweAuthPayloadDtoBuilder()
        .with('signer_address', nonChecksummedAddress as Address)
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

      const userId = await postgresDatabaseService.transaction(
        async (entityManager) => {
          return await usersRepository.create(status, entityManager);
        },
      );

      const users = await dbUserRepository.find({ where: { id: userId } });

      expect(users).toEqual([
        {
          createdAt: expect.any(Date),
          extUserId: null,
          id: users[0].id,
          status,
          updatedAt: expect.any(Date),
        },
      ]);
    });

    it('should throw if an incorrect UserStatus is provided', async () => {
      const status = faker.string.alpha() as unknown as keyof typeof UserStatus;

      await expect(
        postgresDatabaseService.transaction(async (entityManager) => {
          await usersRepository.create(status, entityManager);
        }),
      ).rejects.toThrow(`Invalid enum key: ${status}`);
    });
  });

  describe('getWithWallets', () => {
    it('should return a user with their wallets', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const status = faker.helpers.arrayElement(UserStatusKeys);
      const userInsertResult = await dbUserRepository.insert({
        status,
      });
      const authPayloadDto = siweAuthPayloadDtoBuilder()
        .with('sub', (userInsertResult.identifiers[0].id as number).toString())
        .build();
      const authPayload = new AuthPayload(authPayloadDto);
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

    it('should find by non-checksummed address', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase() as Address;
      const status = faker.helpers.arrayElement(UserStatusKeys);
      const userInsertResult = await dbUserRepository.insert({
        status,
      });
      const authPayloadDto = siweAuthPayloadDtoBuilder()
        .with('signer_address', nonChecksummedAddress)
        .with('sub', (userInsertResult.identifiers[0].id as number).toString())
        .build();
      const authPayload = new AuthPayload(authPayloadDto);
      await dbWalletRepository.insert({
        user: {
          id: userInsertResult.identifiers[0].id,
        },
        address: authPayloadDto.signer_address,
      });
      const wallet = await dbWalletRepository.findOneOrFail({
        where: { address: nonChecksummedAddress },
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

    it('should return wallets linked to an OIDC user', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const status = faker.helpers.arrayElement(UserStatusKeys);
      const userInsertResult = await dbUserRepository.insert({ status });
      const userId = userInsertResult.identifiers[0].id as number;
      const authPayloadDto = oidcAuthPayloadDtoBuilder()
        .with('sub', userId.toString())
        .build();
      const authPayload = new AuthPayload(authPayloadDto);
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const walletInsertResult = await dbWalletRepository.insert({
        user: { id: userId },
        address: walletAddress,
      });
      const walletId = walletInsertResult.identifiers[0].id;

      await expect(
        usersRepository.getWithWallets(authPayload),
      ).resolves.toEqual({
        id: userId,
        status,
        wallets: [
          {
            id: walletId,
            address: walletAddress,
          },
        ],
      });
    });

    it('should return user with empty wallets for OIDC user', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const status = faker.helpers.arrayElement(UserStatusKeys);
      const userInsertResult = await dbUserRepository.insert({ status });
      const userId = userInsertResult.identifiers[0].id as number;
      const authPayloadDto = oidcAuthPayloadDtoBuilder()
        .with('sub', userId.toString())
        .build();
      const authPayload = new AuthPayload(authPayloadDto);

      await expect(
        usersRepository.getWithWallets(authPayload),
      ).resolves.toEqual({
        id: userId,
        status,
        wallets: [],
      });
    });
  });

  describe('addWalletToUser', () => {
    it('should add a wallet to a user', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
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
      expect(wallet).toEqual({
        address: walletAddress,
        createdAt: expect.any(Date),
        id: wallet.id,
        updatedAt: expect.any(Date),
        user: {
          createdAt: expect.any(Date),
          extUserId: null,
          id: wallet.user.id,
          status,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should throw if the user wallet already exists', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
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
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.arrayElement(UserStatusKeys);
      await dbUserRepository.insert({ status });

      await expect(
        usersRepository.addWalletToUser({
          authPayload,
          walletAddress: walletAddress as Address,
        }),
      ).rejects.toThrow(new RegExp(`^Address "${walletAddress}" is invalid.`));
    });

    it('should checksum the inserted wallet address', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
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
        walletAddress: nonChecksummedAddress as Address,
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

  describe('activateIfPending', () => {
    it('should activate a PENDING user', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const userInsertResult = await dbUserRepository.insert({
        status: 'PENDING',
      });
      const userId = userInsertResult.identifiers[0].id as number;

      await usersRepository.activateIfPending(userId);

      const user = await dbUserRepository.findOneBy({ id: userId });
      expect(user?.status).toBe('ACTIVE');
    });

    it('should not change an already ACTIVE user', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const userInsertResult = await dbUserRepository.insert({
        status: 'ACTIVE',
      });
      const userId = userInsertResult.identifiers[0].id as number;

      await usersRepository.activateIfPending(userId);

      const user = await dbUserRepository.findOneBy({ id: userId });
      expect(user?.status).toBe('ACTIVE');
    });

    it('should not throw for non-existent userId', async () => {
      await expect(
        usersRepository.activateIfPending(999999),
      ).resolves.toBeUndefined();
    });
  });

  describe('delete', () => {
    it('should delete a user and their wallets', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const status = faker.helpers.arrayElement(UserStatusKeys);
      const userInsertResult = await dbUserRepository.insert({
        status,
      });
      const userId = userInsertResult.identifiers[0].id as number;
      const authPayloadDto = siweAuthPayloadDtoBuilder()
        .with('sub', userId.toString())
        .build();
      const authPayload = new AuthPayload(authPayloadDto);
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

    it('should delete OIDC user', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const status = faker.helpers.arrayElement(UserStatusKeys);
      const userInsertResult = await dbUserRepository.insert({ status });
      const userId = userInsertResult.identifiers[0].id as number;
      const authPayloadDto = oidcAuthPayloadDtoBuilder()
        .with('sub', userId.toString())
        .build();
      const authPayload = new AuthPayload(authPayloadDto);

      await usersRepository.delete(authPayload);

      await expect(dbUserRepository.find()).resolves.toEqual([]);
    });
  });

  describe('deleteWalletFromUser', () => {
    it('should delete a wallet from a user', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
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
          createdAt: expect.any(Date),
          id: wallets[0].id,
          updatedAt: expect.any(Date),
          user: {
            createdAt: expect.any(Date),
            extUserId: null,
            id: wallets[0].user.id,
            status,
            updatedAt: expect.any(Date),
          },
        },
      ]);
    });

    it('should throw if no wallet is found', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const dbUserRepository = dataSource.getRepository(User);
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
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
        createdAt: expect.any(Date),
        extUserId: null,
        id: userInsertResult.identifiers[0].id,
        status,
        updatedAt: expect.any(Date),
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
        usersRepository.findByWalletAddress(address),
      ).resolves.toEqual({
        createdAt: expect.any(Date),
        extUserId: null,
        id: userInsertResult.identifiers[0].id,
        status,
        updatedAt: expect.any(Date),
      });
    });

    it('should return undefined if no user is found', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      await expect(
        usersRepository.findByWalletAddress(address),
      ).resolves.toBeUndefined();
    });
  });

  describe('findOrCreateByWalletAddress', () => {
    it('should return the existing user id if the wallet already exists', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const address = getAddress(faker.finance.ethereumAddress());
      const status = faker.helpers.arrayElement(UserStatusKeys);
      const userInsertResult = await dbUserRepository.insert({ status });
      const userId = userInsertResult.identifiers[0].id;
      await dbWalletRepository.insert({
        user: { id: userId },
        address,
      });

      const result = await usersRepository.findOrCreateByWalletAddress(address);

      expect(result).toBe(userId);
      // No additional user or wallet should have been created
      await expect(dbUserRepository.find()).resolves.toHaveLength(1);
      await expect(dbWalletRepository.find()).resolves.toHaveLength(1);
    });

    it('should create a new user and wallet if none exists', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const address = getAddress(faker.finance.ethereumAddress());

      const userId = await usersRepository.findOrCreateByWalletAddress(address);

      const user = await dbUserRepository.findOneOrFail({
        where: { id: userId },
      });
      expect(user).toEqual({
        createdAt: expect.any(Date),
        id: userId,
        status: 'ACTIVE',
        updatedAt: expect.any(Date),
        extUserId: null,
      });

      const wallet = await dbWalletRepository.findOneOrFail({
        where: { address },
        relations: { user: true },
      });
      expect(wallet).toEqual({
        address,
        createdAt: expect.any(Date),
        id: wallet.id,
        updatedAt: expect.any(Date),
        user: {
          createdAt: expect.any(Date),
          id: userId,
          status: 'ACTIVE',
          updatedAt: expect.any(Date),
          extUserId: null,
        },
      });
    });

    it('should checksum the wallet address when creating', async () => {
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();

      await usersRepository.findOrCreateByWalletAddress(
        nonChecksummedAddress as Address,
      );

      const wallet = await dbWalletRepository.findOneOrFail({
        where: { address: getAddress(nonChecksummedAddress) },
      });
      expect(wallet).toStrictEqual(
        expect.objectContaining({
          address: getAddress(nonChecksummedAddress),
        }),
      );
    });

    it('should return the existing user id on concurrent duplicate insert', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const dbWalletRepository = dataSource.getRepository(Wallet);
      const address = getAddress(faker.finance.ethereumAddress());

      // Run two calls concurrently — one will win the insert, the other
      // should catch the unique constraint violation and retry the find.
      const [id1, id2] = await Promise.all([
        usersRepository.findOrCreateByWalletAddress(address),
        usersRepository.findOrCreateByWalletAddress(address),
      ]);

      expect(id1).toBe(id2);
      await expect(dbUserRepository.find()).resolves.toHaveLength(1);
      await expect(dbWalletRepository.find()).resolves.toHaveLength(1);
    });
  });

  describe('findOrCreateByExtUserId', () => {
    it('should return the existing user id if the extUserId already exists', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const extUserId = faker.string.uuid();
      const status = faker.helpers.arrayElement(UserStatusKeys);
      const userInsertResult = await dbUserRepository.insert({
        status,
        extUserId,
      });
      const userId = userInsertResult.identifiers[0].id;

      const result = await usersRepository.findOrCreateByExtUserId(extUserId);

      expect(result).toBe(userId);
      // No additional user should have been created
      await expect(dbUserRepository.find()).resolves.toHaveLength(1);
    });

    it('should create a new user if none exists with the given extUserId', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const extUserId = faker.string.uuid();

      const userId = await usersRepository.findOrCreateByExtUserId(extUserId);

      const user = await dbUserRepository.findOneOrFail({
        where: { id: userId },
      });
      expect(user).toEqual({
        createdAt: expect.any(Date),
        extUserId,
        id: userId,
        status: 'ACTIVE',
        updatedAt: expect.any(Date),
      });
    });

    it('should return the existing user id on concurrent duplicate insert', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const extUserId = faker.string.uuid();

      // Run two calls concurrently — one will win the insert, the other
      // should catch the unique constraint violation and retry the find.
      const [id1, id2] = await Promise.all([
        usersRepository.findOrCreateByExtUserId(extUserId),
        usersRepository.findOrCreateByExtUserId(extUserId),
      ]);

      expect(id1).toBe(id2);
      await expect(dbUserRepository.find()).resolves.toHaveLength(1);
    });

    it('should rethrow non-constraint-violation errors', async () => {
      const extUserId = faker.string.uuid();
      const error = new Error('unexpected failure');

      jest.spyOn(usersRepository, 'create').mockRejectedValueOnce(error);

      await expect(
        usersRepository.findOrCreateByExtUserId(extUserId),
      ).rejects.toThrow(error);
    });
  });

  describe('update', () => {
    it('should update a User', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const userInsertResult = await dbUserRepository.insert({
        status: 'PENDING',
      });
      const userId = userInsertResult.identifiers[0].id;

      await postgresDatabaseService.transaction(async (entityManager) => {
        await usersRepository.update({
          userId,
          user: { id: userId, status: 'ACTIVE' },
          entityManager,
        });
      });

      const user = await dbUserRepository.findOneOrFail({
        where: { id: userId },
      });

      expect(user).toEqual({
        createdAt: expect.any(Date),
        extUserId: null,
        id: userId,
        status: 'ACTIVE',
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('update status', () => {
    it('should update a User status', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const userInsertResult = await dbUserRepository.insert({
        status: 'PENDING',
      });
      const userId = userInsertResult.identifiers[0].id;
      const status = 'ACTIVE';

      await postgresDatabaseService.transaction(async (entityManager) => {
        await usersRepository.updateStatus({
          userId,
          status,
          entityManager,
        });
      });

      const user = await dbUserRepository.findOneOrFail({
        where: { id: userId },
      });

      expect(user).toEqual({
        createdAt: expect.any(Date),
        extUserId: null,
        id: userId,
        status,
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('extUserId uniqueness', () => {
    it('should allow multiple users with null extUserId', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const status = faker.helpers.arrayElement(UserStatusKeys);

      await dbUserRepository.insert({ status, extUserId: null });
      await dbUserRepository.insert({ status, extUserId: null });

      const users = await dbUserRepository.find();
      expect(users).toHaveLength(2);
      expect(users[0].extUserId).toBeNull();
      expect(users[1].extUserId).toBeNull();
    });

    it('should allow a user with a unique extUserId', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const status = faker.helpers.arrayElement(UserStatusKeys);
      const extUserId = faker.string.uuid();

      await dbUserRepository.insert({ status, extUserId });

      const user = await dbUserRepository.findOneOrFail({
        where: { extUserId },
      });
      expect(user.extUserId).toBe(extUserId);
    });

    it('should reject duplicate extUserId values', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const status = faker.helpers.arrayElement(UserStatusKeys);
      const extUserId = faker.string.uuid();

      await dbUserRepository.insert({ status, extUserId });

      await expect(
        dbUserRepository.insert({ status, extUserId }),
      ).rejects.toThrow(/duplicate key value violates unique constraint/);
    });

    it('should allow different extUserId values for different users', async () => {
      const dbUserRepository = dataSource.getRepository(User);
      const status = faker.helpers.arrayElement(UserStatusKeys);
      const extUserId1 = faker.string.uuid();
      const extUserId2 = faker.string.uuid();

      await dbUserRepository.insert({ status, extUserId: extUserId1 });
      await dbUserRepository.insert({ status, extUserId: extUserId2 });

      const users = await dbUserRepository.find({ order: { id: 'ASC' } });
      expect(users).toHaveLength(2);
      expect(users[0].extUserId).toBe(extUserId1);
      expect(users[1].extUserId).toBe(extUserId2);
    });
  });
});
