// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DataSource, type Repository } from 'typeorm';
import { type Address, getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import configuration from '#/config/entities/__tests__/configuration';
import { postgresConfig } from '#/config/entities/postgres.config';
import { DatabaseMigrator } from '#/datasources/db/v2/database-migrator.service';
import { PostgresDatabaseService } from '#/datasources/db/v2/postgres-database.service';
import type { ILoggingService } from '#/logging/logging.interface';
import { PolicyConfigurationRequest } from '#/modules/policies/datasources/entities/policy-configuration-request.entity.db';
import { policyConfigurationBuilder } from '#/modules/policies/domain/entities/__tests__/policy-configuration.builder';
import type { PolicyConfiguration } from '#/modules/policies/domain/entities/policy-configuration.entity';
import { SafePolicyGuardConfigurationRequestsRepository } from '#/modules/policies/domain/safe-policy-guard-configuration-requests.repository';
import { configurationRoot } from '#/modules/policies/domain/utils/policy-configuration-root.utils';
import { createMockSpaceEncryptionService } from '#/modules/spaces/domain/__tests__/space-encryption.service.mock';

const mockLoggingService = {
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

describe('SafePolicyGuardConfigurationRequestsRepository', () => {
  let postgresDatabaseService: PostgresDatabaseService;
  let mockConfigService: MockedObject<ConfigService>;
  let encryptionService: ReturnType<typeof createMockSpaceEncryptionService>;
  let repository: SafePolicyGuardConfigurationRequestsRepository;
  let dbRepository: Repository<PolicyConfigurationRequest>;

  const maxPerSafe = 3;
  const retentionDays = 60;
  /** A real Space per test: `space_id` is a foreign key to `spaces`. */
  let spaceId: number;
  const testDatabaseName = faker.string.alpha({ length: 10, casing: 'lower' });
  const testConfiguration = configuration();

  const dataSource = new DataSource({
    ...postgresConfig({
      ...testConfiguration.db.connection.postgres,
      type: 'postgres',
      database: testDatabaseName,
    }),
    migrationsTableName: testConfiguration.db.orm.migrationsTableName,
    entities: [PolicyConfigurationRequest],
  });

  type StorableRequest = Parameters<
    SafePolicyGuardConfigurationRequestsRepository['create']
  >[0];

  /** A request whose root is the hash of its configurations. */
  function storableRequest(args?: {
    spaceId?: number;
    chainId?: string;
    safeAddress?: Address;
    configurations?: StorableRequest['configurations'];
  }): StorableRequest {
    const configurations = args?.configurations ?? [
      policyConfigurationBuilder().build(),
    ];

    return {
      spaceId: args?.spaceId ?? spaceId,
      chainId: args?.chainId ?? '11155111',
      safeAddress:
        args?.safeAddress ?? getAddress(faker.finance.ethereumAddress()),
      root: configurationRoot(configurations),
      configurations,
      createdBy: faker.number.int({ min: 1, max: 1000 }),
    };
  }

  /** Stores {@link maxPerSafe} requests for one Safe in the current Space. */
  async function fillCap(safeAddress: Address): Promise<void> {
    for (let index = 0; index < maxPerSafe; index++) {
      await repository.create(storableRequest({ safeAddress }));
    }
  }

  /** Inserts an active Space and returns its id. */
  async function insertSpace(): Promise<number> {
    const [{ id }] = await postgresDatabaseService
      .getDataSource()
      .query(
        `INSERT INTO "spaces" ("name", "status") VALUES ($1, 1) RETURNING "id"`,
        [faker.word.noun()],
      );
    return id;
  }

  beforeAll(async () => {
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

    postgresDatabaseService = new PostgresDatabaseService(
      mockLoggingService,
      dataSource,
    );
    await postgresDatabaseService.initializeDatabaseConnection();

    mockConfigService = {
      getOrThrow: vi.fn().mockImplementation((key: string) => {
        if (key === 'db.migrator.numberOfRetries') {
          return testConfiguration.db.migrator.numberOfRetries;
        }
        if (key === 'db.migrator.retryAfterMs') {
          return testConfiguration.db.migrator.retryAfterMs;
        }
        if (key === 'policies.maxConfigurationRequestsPerSpaceSafe') {
          return maxPerSafe;
        }
        if (key === 'policies.configurationRequestRetentionDays') {
          return retentionDays;
        }
      }),
    } as MockedObject<ConfigService>;

    await new DatabaseMigrator(
      mockLoggingService,
      postgresDatabaseService,
      mockConfigService,
    ).migrate();

    dbRepository = await postgresDatabaseService.getRepository(
      PolicyConfigurationRequest,
    );
  });

  beforeEach(async () => {
    encryptionService = createMockSpaceEncryptionService();
    repository = new SafePolicyGuardConfigurationRequestsRepository(
      postgresDatabaseService,
      mockConfigService,
      encryptionService,
    );
    spaceId = await insertSpace();
  });

  afterEach(async () => {
    await postgresDatabaseService
      .getDataSource()
      .query(`TRUNCATE "policy_configuration_requests"`);
  });

  afterAll(async () => {
    await postgresDatabaseService.destroyDatabaseConnection();

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
      .query(`DROP DATABASE IF EXISTS ${testDatabaseName}`);
    await testPostgresDatabaseService.destroyDatabaseConnection();
  });

  describe('create', () => {
    it('should store a request with its configurations in hashed order', async () => {
      const configurations: [
        PolicyConfiguration,
        ...Array<PolicyConfiguration>,
      ] = [
        policyConfigurationBuilder().build(),
        policyConfigurationBuilder().build(),
        policyConfigurationBuilder().build(),
      ];
      const request = storableRequest({ configurations });

      await repository.create(request);

      const [stored] = await dbRepository.find();
      expect(stored).toMatchObject({
        spaceId: request.spaceId,
        chainId: request.chainId,
        safeAddress: request.safeAddress,
        safeAddressIndex: null,
        root: request.root,
        createdBy: request.createdBy,
      });
      expect(stored.configurations).toStrictEqual(configurations);
      expect(configurationRoot(stored.configurations)).toBe(request.root);
      expect(stored.createdAt).toBeInstanceOf(Date);
    });

    it('should store the ciphertext and blind index when encryption is enabled', async () => {
      const request = storableRequest();
      const ciphertext = `kms:v1:${faker.string.alphanumeric(32)}`;
      const addressIndex = faker.string.hexadecimal({ length: 64 });
      encryptionService.encryptSafeAddress.mockResolvedValue(ciphertext);
      encryptionService.safeAddressIndex.mockReturnValue(addressIndex);

      await repository.create(request);

      const [stored] = await dbRepository.find();
      expect(stored.safeAddress).toBe(ciphertext);
      expect(stored.safeAddressIndex).toBe(addressIndex);
      expect(encryptionService.encryptSafeAddress).toHaveBeenCalledWith(
        request.spaceId,
        request.safeAddress,
      );
    });

    it('should not store a re-submission again', async () => {
      const request = storableRequest();

      await repository.create(request);
      await repository.create({ ...request, createdBy: request.createdBy + 1 });

      const stored = await dbRepository.find();
      expect(stored).toHaveLength(1);
      // the first write wins; a retry does not rewrite the row
      expect(stored[0].createdBy).toBe(request.createdBy);
    });

    it('should store the same root of a Safe for each Space', async () => {
      const request = storableRequest();
      const otherSpaceId = await insertSpace();

      await repository.create(request);
      await repository.create({ ...request, spaceId: otherSpaceId });

      await expect(dbRepository.count()).resolves.toBe(2);
    });

    it('should keep the same root of two Safes apart', async () => {
      const request = storableRequest();

      await repository.create(request);
      await repository.create({
        ...request,
        safeAddress: getAddress(faker.finance.ethereumAddress()),
      });

      await expect(dbRepository.count()).resolves.toBe(2);
    });

    it('should keep the same root on two chains apart', async () => {
      const request = storableRequest();

      await repository.create(request);
      await repository.create({ ...request, chainId: '1' });

      await expect(dbRepository.count()).resolves.toBe(2);
    });
  });

  describe('cap', () => {
    it('should reject a Safe at the cap', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      await fillCap(safeAddress);

      await expect(
        repository.create(storableRequest({ safeAddress })),
      ).rejects.toThrow(BadRequestException);
      await expect(dbRepository.count()).resolves.toBe(maxPerSafe);
    });

    it('should still accept a re-submission of a stored root at the cap', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const requests = Array.from({ length: maxPerSafe }, () =>
        storableRequest({ safeAddress }),
      );
      for (const request of requests) {
        await repository.create(request);
      }

      await expect(repository.create(requests[0])).resolves.toBeUndefined();
      await expect(dbRepository.count()).resolves.toBe(maxPerSafe);
    });

    it("should reject another Safe's stored root at the cap", async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const otherSafeRequest = storableRequest();
      await repository.create(otherSafeRequest);
      await fillCap(safeAddress);

      await expect(
        repository.create({ ...otherSafeRequest, safeAddress }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not count another Safe towards the cap', async () => {
      await fillCap(getAddress(faker.finance.ethereumAddress()));

      await expect(
        repository.create(storableRequest()),
      ).resolves.toBeUndefined();
    });

    it('should not count the same Safe on another chain towards the cap', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      await fillCap(safeAddress);

      await expect(
        repository.create(storableRequest({ safeAddress, chainId: '1' })),
      ).resolves.toBeUndefined();
    });

    it('should not count the same Safe in another Space towards the cap', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      await fillCap(safeAddress);

      await expect(
        repository.create(
          storableRequest({ safeAddress, spaceId: await insertSpace() }),
        ),
      ).resolves.toBeUndefined();
    });

    it('should match the Safe by its blind index when encryption is enabled', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      encryptionService.safeAddressIndex.mockReturnValue(
        faker.string.hexadecimal({ length: 64 }),
      );
      // Non-deterministic ciphertext, as KMS produces.
      encryptionService.encryptSafeAddress.mockImplementation(() =>
        Promise.resolve(`kms:v1:${faker.string.alphanumeric(32)}`),
      );
      await fillCap(safeAddress);

      await expect(
        repository.create(storableRequest({ safeAddress })),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not exceed the cap under concurrent requests', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      for (let index = 0; index < maxPerSafe - 1; index++) {
        await repository.create(storableRequest({ safeAddress }));
      }

      const results = await Promise.allSettled(
        Array.from({ length: 3 }, () =>
          repository.create(storableRequest({ safeAddress })),
        ),
      );

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      await expect(dbRepository.count()).resolves.toBe(maxPerSafe);
    });
  });

  describe('prune', () => {
    it('should delete only the requests older than the retention', async () => {
      const expired = storableRequest();
      // `created_at` is not insertable through the entity.
      await postgresDatabaseService
        .getDataSource()
        .query(
          `INSERT INTO "policy_configuration_requests" ("space_id", "chain_id", "safe_address", "root", "configurations", "created_by", "created_at") VALUES ($1, $2, $3, $4, $5, $6, NOW() - make_interval(days => $7))`,
          [
            expired.spaceId,
            expired.chainId,
            expired.safeAddress,
            expired.root,
            JSON.stringify(expired.configurations),
            expired.createdBy,
            retentionDays + 1,
          ],
        );
      const recent = storableRequest();
      await repository.create(recent);

      await repository.prune();

      await expect(dbRepository.find()).resolves.toEqual([
        expect.objectContaining({ root: recent.root }),
      ]);
    });
  });

  describe('table constraints', () => {
    it('should delete the stored requests of a deleted space', async () => {
      const request = storableRequest();
      const otherSpaceId = await insertSpace();
      await repository.create(request);
      await repository.create({ ...request, spaceId: otherSpaceId });

      await postgresDatabaseService
        .getDataSource()
        .query(`DELETE FROM "spaces" WHERE "id" = $1`, [spaceId]);

      await expect(dbRepository.countBy({ spaceId })).resolves.toBe(0);
      await expect(
        dbRepository.countBy({ spaceId: otherSpaceId }),
      ).resolves.toBe(1);
    });

    it('should reject an update of a stored request', async () => {
      const request = storableRequest();
      await repository.create(request);

      await expect(
        postgresDatabaseService
          .getDataSource()
          .query(
            `UPDATE "policy_configuration_requests" SET "created_by" = "created_by" + 1 WHERE "root" = $1`,
            [request.root],
          ),
      ).rejects.toThrow('policy_configuration_requests rows are immutable');
    });
  });
});
