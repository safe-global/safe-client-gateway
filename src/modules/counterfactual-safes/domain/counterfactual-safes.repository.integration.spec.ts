// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { DataSource } from 'typeorm';
import { getAddress, type Address } from 'viem';
import configuration from '@/config/entities/__tests__/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { SpaceSafe } from '@/modules/spaces/datasources/entities/space-safes.entity.db';
import { CounterfactualSafe } from '@/modules/counterfactual-safes/datasources/entities/counterfactual-safe.entity.db';
import { CounterfactualSafesRepository } from '@/modules/counterfactual-safes/domain/counterfactual-safes.repository';
import { counterfactualSafeBuilder } from '@/modules/counterfactual-safes/datasources/entities/__tests__/counterfactual-safe.entity.db.builder';
import { UniqueConstraintError } from '@/datasources/errors/unique-constraint-error';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { ConfigService } from '@nestjs/config';
import type { ILoggingService } from '@/logging/logging.interface';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

function buildCounterfactualSafePayload(): Pick<
  CounterfactualSafe,
  | 'chainId'
  | 'address'
  | 'factoryAddress'
  | 'masterCopy'
  | 'saltNonce'
  | 'safeVersion'
  | 'threshold'
  | 'owners'
  | 'fallbackHandler'
  | 'setupTo'
  | 'setupData'
  | 'paymentToken'
  | 'payment'
  | 'paymentReceiver'
> {
  const cfSafe = counterfactualSafeBuilder().build();
  return {
    chainId: cfSafe.chainId,
    address: cfSafe.address,
    factoryAddress: cfSafe.factoryAddress,
    masterCopy: cfSafe.masterCopy,
    saltNonce: cfSafe.saltNonce,
    safeVersion: cfSafe.safeVersion,
    threshold: cfSafe.threshold,
    owners: cfSafe.owners,
    fallbackHandler: cfSafe.fallbackHandler,
    setupTo: cfSafe.setupTo,
    setupData: cfSafe.setupData,
    paymentToken: cfSafe.paymentToken,
    payment: cfSafe.payment,
    paymentReceiver: cfSafe.paymentReceiver,
  };
}

describe('CounterfactualSafesRepository', () => {
  let postgresDatabaseService: PostgresDatabaseService;
  let counterfactualSafesRepo: CounterfactualSafesRepository;
  let dbUserRepo: Repository<User>;
  let dbWalletRepo: Repository<Wallet>;
  let dbCounterfactualSafeRepo: Repository<CounterfactualSafe>;

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
    entities: [CounterfactualSafe, Member, Space, SpaceSafe, User, Wallet],
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

    counterfactualSafesRepo = new CounterfactualSafesRepository(
      postgresDatabaseService,
    );

    dbUserRepo = dataSource.getRepository(User);
    dbWalletRepo = dataSource.getRepository(Wallet);
    dbCounterfactualSafeRepo = dataSource.getRepository(CounterfactualSafe);
  });

  afterEach(async () => {
    jest.resetAllMocks();

    // Delete in dependency order
    await dbCounterfactualSafeRepo
      .createQueryBuilder()
      .delete()
      .where('1=1')
      .execute();
    await dbWalletRepo.createQueryBuilder().delete().where('1=1').execute();
    await dbUserRepo.createQueryBuilder().delete().where('1=1').execute();
  });

  afterAll(async () => {
    await postgresDatabaseService.getDataSource().dropDatabase();
    await postgresDatabaseService.destroyDatabaseConnection();
  });

  describe('createdAt/updatedAt', () => {
    it('should set createdAt and updatedAt when creating a CounterfactualSafe', async () => {
      const user = await dbUserRepo.insert({ status: 'ACTIVE' });
      const userId = user.identifiers[0].id as User['id'];
      const payload = buildCounterfactualSafePayload();
      const before = new Date().getTime();

      await counterfactualSafesRepo.create({
        creatorId: userId,
        payload: [payload],
      });

      const after = new Date().getTime();

      const saved = await dbCounterfactualSafeRepo.findOneOrFail({
        where: { chainId: payload.chainId, address: payload.address },
      });

      expect(saved.createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(saved.createdAt.getTime()).toBeLessThanOrEqual(after);
      expect(saved.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(saved.updatedAt.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('create', () => {
    it('should create a single CounterfactualSafe', async () => {
      const user = await dbUserRepo.insert({ status: 'ACTIVE' });
      const userId = user.identifiers[0].id as User['id'];
      const payload = buildCounterfactualSafePayload();

      await counterfactualSafesRepo.create({
        creatorId: userId,
        payload: [payload],
      });

      const saved = await dbCounterfactualSafeRepo.findOneOrFail({
        where: { chainId: payload.chainId, address: payload.address },
        relations: { creator: true },
      });

      expect(saved).toMatchObject({
        id: expect.any(Number),
        chainId: payload.chainId,
        address: payload.address,
        factoryAddress: payload.factoryAddress,
        masterCopy: payload.masterCopy,
        saltNonce: payload.saltNonce,
        safeVersion: payload.safeVersion,
        threshold: payload.threshold,
        owners: payload.owners,
        fallbackHandler: payload.fallbackHandler,
        setupTo: payload.setupTo,
        setupData: payload.setupData,
        paymentToken: payload.paymentToken,
        payment: payload.payment,
        paymentReceiver: payload.paymentReceiver,
        creator: expect.objectContaining({ id: userId }),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should create multiple CounterfactualSafes', async () => {
      const user = await dbUserRepo.insert({ status: 'ACTIVE' });
      const userId = user.identifiers[0].id as User['id'];
      const payload1 = buildCounterfactualSafePayload();
      const payload2 = buildCounterfactualSafePayload();

      await counterfactualSafesRepo.create({
        creatorId: userId,
        payload: [payload1, payload2],
      });

      const all = await dbCounterfactualSafeRepo.find();
      expect(all).toHaveLength(2);
    });

    it('should create with null creatorId', async () => {
      const payload = buildCounterfactualSafePayload();

      await counterfactualSafesRepo.create({
        creatorId: null,
        payload: [payload],
      });

      const saved = await dbCounterfactualSafeRepo.findOneOrFail({
        where: { chainId: payload.chainId, address: payload.address },
      });

      expect(saved.chainId).toBe(payload.chainId);
      expect(saved.address).toBe(payload.address);
    });

    it('should create with nullable address fields set to null', async () => {
      const user = await dbUserRepo.insert({ status: 'ACTIVE' });
      const userId = user.identifiers[0].id as User['id'];
      const payload = {
        ...buildCounterfactualSafePayload(),
        fallbackHandler: null,
        setupTo: null,
        paymentToken: null,
        payment: null,
        paymentReceiver: null,
      };

      await counterfactualSafesRepo.create({
        creatorId: userId,
        payload: [payload],
      });

      const saved = await dbCounterfactualSafeRepo.findOneOrFail({
        where: { chainId: payload.chainId, address: payload.address },
      });

      expect(saved.fallbackHandler).toBeNull();
      expect(saved.setupTo).toBeNull();
      expect(saved.paymentToken).toBeNull();
      expect(saved.payment).toBeNull();
      expect(saved.paymentReceiver).toBeNull();
    });

    it('should throw UniqueConstraintError on duplicate chainId + address', async () => {
      const user = await dbUserRepo.insert({ status: 'ACTIVE' });
      const userId = user.identifiers[0].id as User['id'];
      const payload = buildCounterfactualSafePayload();

      await counterfactualSafesRepo.create({
        creatorId: userId,
        payload: [payload],
      });

      await expect(
        counterfactualSafesRepo.create({
          creatorId: userId,
          payload: [payload],
        }),
      ).rejects.toThrow(UniqueConstraintError);
    });
  });

  describe('findByCreatorId', () => {
    it('should return counterfactual safes for a creator', async () => {
      const user = await dbUserRepo.insert({ status: 'ACTIVE' });
      const userId = user.identifiers[0].id as User['id'];
      const payload = buildCounterfactualSafePayload();

      await counterfactualSafesRepo.create({
        creatorId: userId,
        payload: [payload],
      });

      const found = await counterfactualSafesRepo.findByCreatorId({
        creatorId: userId,
      });

      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({
        chainId: payload.chainId,
        address: payload.address,
      });
    });

    it('should return empty array for a creator with no safes', async () => {
      const user = await dbUserRepo.insert({ status: 'ACTIVE' });
      const userId = user.identifiers[0].id as User['id'];

      const found = await counterfactualSafesRepo.findByCreatorId({
        creatorId: userId,
      });

      expect(found).toEqual([]);
    });

    it('should not return safes created by another user', async () => {
      const user1 = await dbUserRepo.insert({ status: 'ACTIVE' });
      const userId1 = user1.identifiers[0].id as User['id'];
      const user2 = await dbUserRepo.insert({ status: 'ACTIVE' });
      const userId2 = user2.identifiers[0].id as User['id'];
      const payload = buildCounterfactualSafePayload();

      await counterfactualSafesRepo.create({
        creatorId: userId1,
        payload: [payload],
      });

      const found = await counterfactualSafesRepo.findByCreatorId({
        creatorId: userId2,
      });

      expect(found).toEqual([]);
    });
  });

  describe('findOrFail', () => {
    it('should return counterfactual safes matching the query', async () => {
      const user = await dbUserRepo.insert({ status: 'ACTIVE' });
      const userId = user.identifiers[0].id as User['id'];
      const payload = buildCounterfactualSafePayload();

      await counterfactualSafesRepo.create({
        creatorId: userId,
        payload: [payload],
      });

      const found = await counterfactualSafesRepo.findOrFail({
        where: { creator: { id: userId } },
      });

      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({
        chainId: payload.chainId,
        address: payload.address,
      });
    });

    it('should throw NotFoundException if none found', async () => {
      const user = await dbUserRepo.insert({ status: 'ACTIVE' });
      const userId = user.identifiers[0].id as User['id'];

      await expect(
        counterfactualSafesRepo.findOrFail({
          where: { creator: { id: userId } },
        }),
      ).rejects.toThrow(
        new NotFoundException('Counterfactual Safe not found.'),
      );
    });
  });

  describe('find', () => {
    it('should return counterfactual safes matching the query', async () => {
      const user = await dbUserRepo.insert({ status: 'ACTIVE' });
      const userId = user.identifiers[0].id as User['id'];
      const payload1 = buildCounterfactualSafePayload();
      const payload2 = buildCounterfactualSafePayload();

      await counterfactualSafesRepo.create({
        creatorId: userId,
        payload: [payload1, payload2],
      });

      const found = await counterfactualSafesRepo.find({
        where: { creator: { id: userId } },
      });

      expect(found).toHaveLength(2);
    });

    it('should return empty array if none found', async () => {
      const user = await dbUserRepo.insert({ status: 'ACTIVE' });
      const userId = user.identifiers[0].id as User['id'];

      const found = await counterfactualSafesRepo.find({
        where: { creator: { id: userId } },
      });

      expect(found).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should delete a counterfactual safe scoped by creator', async () => {
      const user = await dbUserRepo.insert({ status: 'ACTIVE' });
      const userId = user.identifiers[0].id as User['id'];
      const payload = buildCounterfactualSafePayload();

      await counterfactualSafesRepo.create({
        creatorId: userId,
        payload: [payload],
      });

      await counterfactualSafesRepo.delete({
        creatorId: userId,
        payload: [{ chainId: payload.chainId, address: payload.address }],
      });

      const remaining = await dbCounterfactualSafeRepo.find();
      expect(remaining).toHaveLength(0);
    });

    it('should delete multiple counterfactual safes', async () => {
      const user = await dbUserRepo.insert({ status: 'ACTIVE' });
      const userId = user.identifiers[0].id as User['id'];
      const payload1 = buildCounterfactualSafePayload();
      const payload2 = buildCounterfactualSafePayload();

      await counterfactualSafesRepo.create({
        creatorId: userId,
        payload: [payload1, payload2],
      });

      await counterfactualSafesRepo.delete({
        creatorId: userId,
        payload: [
          { chainId: payload1.chainId, address: payload1.address },
          { chainId: payload2.chainId, address: payload2.address },
        ],
      });

      const remaining = await dbCounterfactualSafeRepo.find();
      expect(remaining).toHaveLength(0);
    });

    it('should throw NotFoundException if counterfactual safe does not exist', async () => {
      const user = await dbUserRepo.insert({ status: 'ACTIVE' });
      const userId = user.identifiers[0].id as User['id'];

      await expect(
        counterfactualSafesRepo.delete({
          creatorId: userId,
          payload: [
            {
              chainId: faker.string.numeric(),
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        }),
      ).rejects.toThrow(
        new NotFoundException('Counterfactual Safe not found.'),
      );
    });

    it("should not allow deleting another user's counterfactual safe", async () => {
      const user1 = await dbUserRepo.insert({ status: 'ACTIVE' });
      const userId1 = user1.identifiers[0].id as User['id'];
      const user2 = await dbUserRepo.insert({ status: 'ACTIVE' });
      const userId2 = user2.identifiers[0].id as User['id'];
      const payload = buildCounterfactualSafePayload();

      await counterfactualSafesRepo.create({
        creatorId: userId1,
        payload: [payload],
      });

      // user2 tries to delete user1's safe — should not find it
      await expect(
        counterfactualSafesRepo.delete({
          creatorId: userId2,
          payload: [{ chainId: payload.chainId, address: payload.address }],
        }),
      ).rejects.toThrow(
        new NotFoundException('Counterfactual Safe not found.'),
      );

      // The safe should still exist
      const remaining = await dbCounterfactualSafeRepo.find();
      expect(remaining).toHaveLength(1);
    });

    it('should throw BadRequestException if found count does not match payload count', async () => {
      const user = await dbUserRepo.insert({ status: 'ACTIVE' });
      const userId = user.identifiers[0].id as User['id'];
      const payload = buildCounterfactualSafePayload();

      await counterfactualSafesRepo.create({
        creatorId: userId,
        payload: [payload],
      });

      await expect(
        counterfactualSafesRepo.delete({
          creatorId: userId,
          payload: [
            { chainId: payload.chainId, address: payload.address },
            {
              chainId: faker.string.numeric(),
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('address checksumming', () => {
    it('should store non-checksummed addresses as checksummed', async () => {
      const user = await dbUserRepo.insert({ status: 'ACTIVE' });
      const userId = user.identifiers[0].id as User['id'];
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase() as Address;
      const checksummedAddress = getAddress(nonChecksummedAddress);
      const payload = {
        ...buildCounterfactualSafePayload(),
        address: nonChecksummedAddress,
      };

      await counterfactualSafesRepo.create({
        creatorId: userId,
        payload: [payload],
      });

      const saved = await dbCounterfactualSafeRepo.findOneOrFail({
        where: { chainId: payload.chainId },
      });

      expect(saved.address).toEqual(checksummedAddress);
    });
  });
});
