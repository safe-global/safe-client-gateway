// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DataSource, type Repository } from 'typeorm';
import { type Address, getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import configuration from '@/config/entities/__tests__/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import type { ILoggingService } from '@/logging/logging.interface';
import { PolicyConfigurationRequest } from '@/modules/policies/datasources/entities/policy-configuration-request.entity.db';
import { policyConfigurationBuilder } from '@/modules/policies/domain/entities/__tests__/policy-configuration.builder';
import type { PolicyConfiguration } from '@/modules/policies/domain/entities/policy-configuration.entity';
import { PolicyConfigurationRequestsRepository } from '@/modules/policies/domain/policy-configuration-requests.repository';
import { configurationRoot } from '@/modules/policies/domain/utils/policy-configuration-root.utils';

const mockLoggingService = {
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

describe('PolicyConfigurationRequestsRepository', () => {
  let postgresDatabaseService: PostgresDatabaseService;
  let repository: PolicyConfigurationRequestsRepository;
  let dbRepository: Repository<PolicyConfigurationRequest>;

  const maxPerSafe = 3;
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
    PolicyConfigurationRequestsRepository['create']
  >[0] & { configurations: Array<PolicyConfiguration> };

  /** A request whose root is the hash of its configurations. */
  function storableRequest(args?: {
    chainId?: string;
    safeAddress?: Address;
  }): StorableRequest {
    const configurations = [policyConfigurationBuilder().build()];

    return {
      chainId: args?.chainId ?? '11155111',
      safeAddress:
        args?.safeAddress ?? getAddress(faker.finance.ethereumAddress()),
      root: configurationRoot(configurations),
      configurations,
      spaceId: faker.number.int({ min: 1, max: 1000 }),
      createdBy: faker.number.int({ min: 1, max: 1000 }),
    };
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

    const mockConfigService = {
      getOrThrow: vi.fn().mockImplementation((key: string) => {
        if (key === 'db.migrator.numberOfRetries') {
          return testConfiguration.db.migrator.numberOfRetries;
        }
        if (key === 'db.migrator.retryAfterMs') {
          return testConfiguration.db.migrator.retryAfterMs;
        }
        if (key === 'policies.maxConfigurationRequestsPerSafe') {
          return maxPerSafe;
        }
      }),
    } as MockedObject<ConfigService>;

    await new DatabaseMigrator(
      mockLoggingService,
      postgresDatabaseService,
      mockConfigService,
    ).migrate();

    repository = new PolicyConfigurationRequestsRepository(
      postgresDatabaseService,
      mockConfigService,
    );
    dbRepository = await postgresDatabaseService.getRepository(
      PolicyConfigurationRequest,
    );
  });

  afterEach(async () => {
    await dbRepository.clear();
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
    it('should store a request', async () => {
      const request = storableRequest();

      await repository.create(request);

      const [stored] = await dbRepository.find();
      expect(stored).toMatchObject({
        chainId: request.chainId,
        safeAddress: request.safeAddress,
        root: request.root,
        configurations: request.configurations,
        spaceId: request.spaceId,
        createdBy: request.createdBy,
      });
      expect(stored.createdAt).toBeInstanceOf(Date);
    });

    it('should be idempotent per chain, Safe and root', async () => {
      const request = storableRequest();

      await repository.create(request);
      await repository.create({ ...request, createdBy: request.createdBy + 1 });

      const stored = await dbRepository.find();
      expect(stored).toHaveLength(1);
      // the first write wins; a retry does not rewrite the row
      expect(stored[0].createdBy).toBe(request.createdBy);
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

    it('should reject a Safe at the storage cap', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      for (let index = 0; index < maxPerSafe; index++) {
        await repository.create(storableRequest({ safeAddress }));
      }

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

      // No new row, so the cap is not exceeded and the retry must not fail.
      await expect(repository.create(requests[0])).resolves.toBeUndefined();
    });

    it('should not count another Safe towards the cap', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      for (let index = 0; index < maxPerSafe; index++) {
        await repository.create(storableRequest({ safeAddress }));
      }

      await expect(
        repository.create(storableRequest()),
      ).resolves.toBeUndefined();
    });
  });
});
