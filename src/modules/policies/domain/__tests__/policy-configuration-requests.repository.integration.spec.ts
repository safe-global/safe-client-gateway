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
import {
  MAX_POLICY_CONFIGURATIONS_BYTES,
  type PolicyConfiguration,
} from '#/modules/policies/domain/entities/policy-configuration.entity';
import { PolicyConfigurationRequestsRepository } from '#/modules/policies/domain/policy-configuration-requests.repository';
import { configurationRoot } from '#/modules/policies/domain/utils/policy-configuration-root.utils';

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
      spaceId,
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

  beforeEach(async () => {
    spaceId = await insertSpace();
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

  describe('table constraints', () => {
    it('should delete the stored configurations of a deleted space', async () => {
      await repository.create(storableRequest());

      await postgresDatabaseService
        .getDataSource()
        .query(`DELETE FROM "spaces" WHERE "id" = $1`, [spaceId]);

      await expect(dbRepository.countBy({ spaceId })).resolves.toBe(0);
    });

    it('should reject an update of a stored row', async () => {
      const request = storableRequest();
      await repository.create(request);

      await expect(
        postgresDatabaseService
          .getDataSource()
          .query(
            `UPDATE "policy_configuration_requests" SET "configurations" = '[]' WHERE "root" = $1`,
            [request.root],
          ),
      ).rejects.toThrow('policy_configuration_requests rows are immutable');
    });

    it('should still allow a stored row to be deleted', async () => {
      const request = storableRequest();
      await repository.create(request);

      await dbRepository.delete({ root: request.root });

      await expect(dbRepository.countBy({ root: request.root })).resolves.toBe(
        0,
      );
    });

    it('should reject configurations larger than 64 KiB', async () => {
      // Written past the repository, which validates nothing about size: this
      // is the check constraint's own guarantee.
      const oversized = JSON.stringify([
        { data: `0x${'ab'.repeat(MAX_POLICY_CONFIGURATIONS_BYTES / 2)}` },
      ]);

      await expect(
        postgresDatabaseService.getDataSource().query(
          `INSERT INTO "policy_configuration_requests"
             ("chain_id", "safe_address", "root", "configurations", "space_id", "created_by")
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            faker.string.numeric(5),
            getAddress(faker.finance.ethereumAddress()),
            faker.string.hexadecimal({ length: 64, casing: 'lower' }),
            oversized,
            spaceId,
            faker.number.int({ min: 1, max: 1000 }),
          ],
        ),
      ).rejects.toThrow('CHK_PCR_configurations_size');
    });
  });
});
