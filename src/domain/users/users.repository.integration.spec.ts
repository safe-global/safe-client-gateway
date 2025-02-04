import { faker } from '@faker-js/faker';
import { DataSource } from 'typeorm';
import configuration from '@/config/entities/__tests__/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { User } from '@/datasources/users/entities/users.entity.db';
import { UsersRepository } from '@/domain/users/users.repository';
import { WalletsRepository } from '@/domain/wallets/wallets.repository';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { UserStatus } from '@/domain/users/entities/user.entity';
import { Wallet } from '@/datasources/wallets/entities/wallets.entity.db';
import type { ConfigService } from '@nestjs/config';
import type { ILoggingService } from '@/logging/logging.interface';
import { getAddress } from 'viem';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

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

    // Truncate tables
    const walletRepository = dataSource.getRepository(Wallet);
    const userRepository = dataSource.getRepository(User);

    await walletRepository.createQueryBuilder().delete().where('1=1').execute();
    await userRepository.createQueryBuilder().delete().where('1=1').execute();
  });

  afterAll(async () => {
    await postgresDatabaseService.getDataSource().dropDatabase();
    await postgresDatabaseService.destroyDatabaseConnection();
  });

  // As the triggers are set on the database level, Jest's fake timers are not accurate
  describe('created_at/updated_at', () => {
    it('should set created_at and updated_at when creating a User', async () => {
      const userRepository = dataSource.getRepository(User);

      const before = new Date().getTime();
      const user = await userRepository.insert({
        status: faker.helpers.enumValue(UserStatus),
      });

      const after = new Date().getTime();

      const createdAt = (user.generatedMaps[0].created_at as Date).getTime();
      const updatedAt = (user.generatedMaps[0].updated_at as Date).getTime();

      expect(createdAt).toEqual(updatedAt);

      expect(createdAt).toBeGreaterThanOrEqual(before);
      expect(createdAt).toBeLessThanOrEqual(after);

      expect(updatedAt).toBeGreaterThanOrEqual(before);
      expect(updatedAt).toBeLessThanOrEqual(after);
    });

    it('should update updated_at when updating a User', async () => {
      const userRepository = dataSource.getRepository(User);

      const user = await userRepository.insert({
        status: UserStatus.PENDING,
      });
      const userId = user.identifiers[0].id as User['id'];
      await userRepository.update(userId, {
        status: UserStatus.ACTIVE,
      });
      const updatedUser = await userRepository.findOneOrFail({
        where: { id: userId },
      });

      const createdAt = updatedUser.created_at.getTime();
      const updatedAt = updatedUser.updated_at.getTime();

      expect(createdAt).toBeLessThan(updatedAt);
    });
  });

  describe('createWithWallet', () => {
    it('should insert a new user and a linked wallet', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.enumValue(UserStatus);

      await usersRepository.createWithWallet({ status, authPayload });

      const walletRepository = dataSource.getRepository(Wallet);
      const userRepository = dataSource.getRepository(User);
      const wallet = await walletRepository.findOneOrFail({
        where: { address: authPayload.signer_address },
        relations: { user: true },
      });
      const user = await userRepository.findOneOrFail({
        where: { id: wallet.user.id },
      });

      expect(wallet).toStrictEqual(
        expect.objectContaining({
          address: authPayload.signer_address,
          created_at: expect.any(Date),
          id: wallet.id,
          updated_at: expect.any(Date),
          user: expect.objectContaining({
            created_at: expect.any(Date),
            id: user.id,
            status,
            updated_at: expect.any(Date),
          }),
        }),
      );
      expect(user).toStrictEqual(
        expect.objectContaining({
          created_at: expect.any(Date),
          id: user.id,
          status,
          updated_at: expect.any(Date),
        }),
      );
    });

    it('should throw an error if the wallet already exists', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.enumValue(UserStatus);

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
      const status = faker.string.alpha() as unknown as UserStatus;

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
      const status = faker.helpers.enumValue(UserStatus);

      await expect(
        usersRepository.createWithWallet({ status, authPayload }),
      ).rejects.toThrow(new RegExp(`^Address "${signerAddress}" is invalid.`));
    });

    it('should checksum the inserted wallet address', async () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', nonChecksummedAddress as `0x${string}`)
        .build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.enumValue(UserStatus);

      await usersRepository.createWithWallet({ status, authPayload });

      const walletRepository = dataSource.getRepository(Wallet);
      const wallet = await walletRepository.findOneOrFail({
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
      const status = faker.helpers.enumValue(UserStatus);

      await postgresDatabaseService.transaction(async (entityManager) => {
        await usersRepository.create(status, entityManager);
      });

      const userRepository = dataSource.getRepository(User);
      const users = await userRepository.find();

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
      const status = faker.string.alpha() as unknown as UserStatus;

      await expect(
        postgresDatabaseService.transaction(async (entityManager) => {
          await usersRepository.create(status, entityManager);
        }),
      ).rejects.toThrow(`invalid input syntax for type integer: "${status}"`);
    });
  });

  describe('getWithWallets', () => {
    it('should return a user with their wallets', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.enumValue(UserStatus);
      await postgresDatabaseService.transaction(async (entityManager) => {
        const userInsertResult = await entityManager.insert(User, {
          status,
        });

        await entityManager.insert(Wallet, {
          user: {
            id: userInsertResult.identifiers[0].id,
          },
          address: authPayloadDto.signer_address,
        });
      });
      const walletRepository = dataSource.getRepository(Wallet);
      const userRepository = dataSource.getRepository(User);
      const wallet = await walletRepository.findOneOrFail({
        where: { address: authPayload.signer_address },
        relations: { user: true },
      });
      const user = await userRepository.findOneOrFail({
        where: { id: wallet.user.id },
      });

      await expect(
        usersRepository.getWithWallets(authPayload),
      ).resolves.toEqual({
        id: user.id,
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
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.enumValue(UserStatus);
      const userRepository = dataSource.getRepository(User);
      await userRepository.insert({ status });

      await expect(usersRepository.getWithWallets(authPayload)).rejects.toThrow(
        `Wallet not found. Address=${authPayload.signer_address}`,
      );
    });

    it('should find by non-checksummed address', async () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', nonChecksummedAddress as `0x${string}`)
        .build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.enumValue(UserStatus);
      await postgresDatabaseService.transaction(async (entityManager) => {
        const userInsertResult = await entityManager.insert(User, {
          status,
        });

        await entityManager.insert(Wallet, {
          user: {
            id: userInsertResult.identifiers[0].id,
          },
          address: authPayloadDto.signer_address,
        });
      });
      const walletRepository = dataSource.getRepository(Wallet);
      const userRepository = dataSource.getRepository(User);
      const wallet = await walletRepository.findOneOrFail({
        where: { address: getAddress(nonChecksummedAddress) },
        relations: { user: true },
      });
      const user = await userRepository.findOneOrFail({
        where: { id: wallet.user.id },
      });

      await expect(
        usersRepository.getWithWallets(authPayload),
      ).resolves.toEqual({
        id: user.id,
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
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.enumValue(UserStatus);
      await postgresDatabaseService.transaction(async (entityManager) => {
        const userInsertResult = await entityManager.insert(User, {
          status,
        });

        await entityManager.insert(Wallet, {
          user: {
            id: userInsertResult.identifiers[0].id,
          },
          address: authPayloadDto.signer_address,
        });
      });

      await usersRepository.addWalletToUser({
        authPayload,
        walletAddress,
      });

      const walletRepository = dataSource.getRepository(Wallet);
      const wallet = await walletRepository.findOneOrFail({
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
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.enumValue(UserStatus);
      await postgresDatabaseService.transaction(async (entityManager) => {
        const userInsertResult = await entityManager.insert(User, {
          status,
        });

        await entityManager.insert(Wallet, {
          user: {
            id: userInsertResult.identifiers[0].id,
          },
          address: authPayloadDto.signer_address,
        });
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
      const walletAddress = faker.string.hexadecimal({
        length: { min: 41, max: 41 },
      });
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.enumValue(UserStatus);
      const userRepository = dataSource.getRepository(User);
      await userRepository.insert({ status });

      await expect(
        usersRepository.addWalletToUser({
          authPayload,
          walletAddress: walletAddress as `0x${string}`,
        }),
      ).rejects.toThrow(new RegExp(`^Address "${walletAddress}" is invalid.`));
    });

    it('should checksum the inserted wallet address', async () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.enumValue(UserStatus);
      await postgresDatabaseService.transaction(async (entityManager) => {
        const userInsertResult = await entityManager.insert(User, {
          status,
        });

        await entityManager.insert(Wallet, {
          user: {
            id: userInsertResult.identifiers[0].id,
          },
          address: authPayloadDto.signer_address,
        });
      });

      await usersRepository.addWalletToUser({
        authPayload,
        walletAddress: nonChecksummedAddress as `0x${string}`,
      });

      const walletRepository = dataSource.getRepository(Wallet);
      const wallet = await walletRepository.findOneOrFail({
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
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.enumValue(UserStatus);
      await postgresDatabaseService.transaction(async (entityManager) => {
        const userInsertResult = await entityManager.insert(User, {
          status,
        });
        const userId = userInsertResult.identifiers[0].id;

        await entityManager.insert(Wallet, {
          user: {
            id: userId,
          },
          address: authPayloadDto.signer_address,
        });
        await entityManager.insert(Wallet, {
          user: {
            id: userId,
          },
          address: walletAddress,
        });
      });

      await usersRepository.delete(authPayload);

      await expect(dataSource.getRepository(User).find()).resolves.toEqual([]);
      // By cascade
      await expect(dataSource.getRepository(Wallet).find()).resolves.toEqual(
        [],
      );
    });

    it('should throw if no user wallet is found', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.enumValue(UserStatus);
      const userRepository = dataSource.getRepository(User);
      await userRepository.insert({ status });

      await expect(usersRepository.delete(authPayload)).rejects.toThrow(
        `Wallet not found. Address=${authPayload.signer_address}`,
      );
    });
  });

  describe('deleteWalletFromUser', () => {
    it('should delete a wallet from a user', async () => {
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.enumValue(UserStatus);
      await postgresDatabaseService.transaction(async (entityManager) => {
        const userInsertResult = await entityManager.insert(User, {
          status,
        });
        const userId = userInsertResult.identifiers[0].id;

        await entityManager.insert(Wallet, {
          user: {
            id: userId,
          },
          address: authPayloadDto.signer_address,
        });
        await entityManager.insert(Wallet, {
          user: {
            id: userId,
          },
          address: walletAddress,
        });
      });

      await usersRepository.deleteWalletFromUser({
        walletAddress,
        authPayload,
      });

      const walletRepository = dataSource.getRepository(Wallet);
      const wallets = await walletRepository.find({
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
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = faker.helpers.enumValue(UserStatus);
      await postgresDatabaseService.transaction(async (entityManager) => {
        const userInsertResult = await entityManager.insert(User, {
          status,
        });

        await entityManager.insert(Wallet, {
          user: {
            id: userInsertResult.identifiers[0].id,
          },
          address: authPayloadDto.signer_address,
        });
      });

      await expect(
        usersRepository.deleteWalletFromUser({
          walletAddress,
          authPayload,
        }),
      ).rejects.toThrow('Wallet not found.');
    });
  });
});
