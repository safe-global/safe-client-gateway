// SPDX-License-Identifier: FSL-1.1-MIT

import { randomUUID } from 'node:crypto';
import { faker } from '@faker-js/faker';
import type { ConfigService } from '@nestjs/config';
import { DataSource, type ObjectLiteral } from 'typeorm';
import type { MockedObject } from 'vitest';
import configuration from '@/config/entities/__tests__/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import type { ILoggingService } from '@/logging/logging.interface';
import { Feature } from '@/modules/entitlements/datasources/entities/feature.entity.db';
import { SpaceFeatureUsage } from '@/modules/entitlements/datasources/entities/space-feature-usage.entity.db';
import { SpaceSubscription } from '@/modules/entitlements/datasources/entities/space-subscription.entity.db';
import { SubscriptionEntitlement } from '@/modules/entitlements/datasources/entities/subscription-entitlement.entity.db';
import { featureBuilder } from '@/modules/entitlements/domain/entities/__tests__/feature.builder';
import { FeatureType } from '@/modules/entitlements/domain/entities/feature.entity';
import { SpaceFeatureUsageRepository } from '@/modules/entitlements/domain/space-feature-usage.repository';
import type { UsageKey } from '@/modules/entitlements/domain/space-feature-usage.repository.interface';
import { SpaceSafe } from '@/modules/spaces/datasources/safes/entities/space-safes.entity.db';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';

const mockLoggingService = {
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

describe('SpaceFeatureUsageRepository', () => {
  let postgresDatabaseService: PostgresDatabaseService;
  let spaceFeatureUsageRepository: SpaceFeatureUsageRepository;

  // Not faker: a fixed FAKER_SEED would hand every spec file the same name.
  const testDatabaseName = `test_${randomUUID().replaceAll('-', '')}`;
  const testConfiguration = configuration();

  const dataSource = new DataSource({
    ...postgresConfig({
      ...testConfiguration.db.connection.postgres,
      type: 'postgres',
      database: testDatabaseName,
    }),
    migrationsTableName: testConfiguration.db.orm.migrationsTableName,
    entities: [
      Feature,
      Member,
      Space,
      SpaceFeatureUsage,
      SpaceSafe,
      SpaceSubscription,
      SubscriptionEntitlement,
      User,
      Wallet,
    ],
  });

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
      }),
    } as MockedObject<ConfigService>;
    const migrator = new DatabaseMigrator(
      mockLoggingService,
      postgresDatabaseService,
      mockConfigService,
    );
    await migrator.migrate();

    spaceFeatureUsageRepository = new SpaceFeatureUsageRepository(
      postgresDatabaseService,
    );
  });

  afterEach(async () => {
    vi.resetAllMocks();

    // Dependency order: a usage row references both, and the feature's FK
    // is ON DELETE RESTRICT.
    await deleteAll(SpaceFeatureUsage);
    await deleteAll(Space);
    await deleteAll(Feature);
  });

  afterAll(async () => {
    await postgresDatabaseService.getDataSource().dropDatabase();
    await postgresDatabaseService.destroyDatabaseConnection();
  });

  async function deleteAll<T extends ObjectLiteral>(entity: {
    new (): T;
  }): Promise<void> {
    await dataSource
      .getRepository(entity)
      .createQueryBuilder()
      .delete()
      .execute();
  }

  async function createSpace(): Promise<Space['id']> {
    const inserted = await dataSource.getRepository(Space).insert({
      name: nameBuilder(),
      status: 'ACTIVE',
    });
    return inserted.generatedMaps[0].id as Space['id'];
  }

  // Only metered features get counters; the rest of the row is incidental.
  async function createFeature(): Promise<Feature['id']> {
    const feature = featureBuilder().with('type', FeatureType.Metered).build();
    const inserted = await dataSource.getRepository(Feature).insert({
      key: feature.key,
      type: feature.type,
      description: feature.description,
      freeEnabled: feature.freeEnabled,
      freeQuota: feature.freeQuota,
      freeValue: feature.freeValue,
      freePeriod: feature.freePeriod,
    });
    return inserted.generatedMaps[0].id as Feature['id'];
  }

  async function usageKey(): Promise<UsageKey> {
    return {
      featureId: await createFeature(),
      periodStart: faker.date.recent(),
    };
  }

  describe('incrementUsage', () => {
    it('should create the counter when the period has none yet', async () => {
      const spaceId = await createSpace();
      const period = await usageKey();
      const delta = faker.number.int({ min: 1, max: 10 });

      await expect(
        spaceFeatureUsageRepository.incrementUsage({
          spaceId,
          period,
          delta,
        }),
      ).resolves.toBe(delta);
    });

    it('should add to a counter that already exists', async () => {
      const spaceId = await createSpace();
      const period = await usageKey();
      const first = faker.number.int({ min: 1, max: 10 });
      const second = faker.number.int({ min: 1, max: 10 });

      await spaceFeatureUsageRepository.incrementUsage({
        spaceId,
        period,
        delta: first,
      });

      await expect(
        spaceFeatureUsageRepository.incrementUsage({
          spaceId,
          period,
          delta: second,
        }),
      ).resolves.toBe(first + second);
    });

    it('should count each period of a feature separately', async () => {
      const spaceId = await createSpace();
      const { featureId } = await usageKey();
      const delta = faker.number.int({ min: 1, max: 10 });
      const previous = faker.date.past();
      const current = faker.date.recent();

      await spaceFeatureUsageRepository.incrementUsage({
        spaceId,
        period: { featureId, periodStart: previous },
        delta,
      });

      // A new period starts from zero: the quota reset is implicit.
      await expect(
        spaceFeatureUsageRepository.incrementUsage({
          spaceId,
          period: { featureId, periodStart: current },
          delta,
        }),
      ).resolves.toBe(delta);
    });

    it('should count each space separately', async () => {
      const period = await usageKey();
      const spaceId = await createSpace();
      const otherSpaceId = await createSpace();
      const delta = faker.number.int({ min: 1, max: 10 });

      await spaceFeatureUsageRepository.incrementUsage({
        spaceId,
        period,
        delta,
      });

      await expect(
        spaceFeatureUsageRepository.incrementUsage({
          spaceId: otherSpaceId,
          period,
          delta,
        }),
      ).resolves.toBe(delta);
    });

    it('should not lose concurrent increments', async () => {
      const spaceId = await createSpace();
      const period = await usageKey();
      const callers = faker.number.int({ min: 5, max: 10 });

      // A read-then-write would let these overlap and undercount.
      const totals = await Promise.all(
        Array.from({ length: callers }, () =>
          spaceFeatureUsageRepository.incrementUsage({
            spaceId,
            period,
            delta: 1,
          }),
        ),
      );

      expect(totals.toSorted((a, b) => a - b)).toStrictEqual(
        Array.from({ length: callers }, (_, index) => index + 1),
      );
    });

    it("should release the count when the caller's transaction rolls back", async () => {
      const spaceId = await createSpace();
      const period = await usageKey();
      const delta = faker.number.int({ min: 1, max: 10 });
      const rejection = new Error(faker.lorem.sentence());

      await expect(
        postgresDatabaseService.transaction(async (entityManager) => {
          await spaceFeatureUsageRepository.incrementUsage(
            { spaceId, period, delta },
            entityManager,
          );
          // What an exhausted quota does.
          throw rejection;
        }),
      ).rejects.toThrow(rejection);

      await expect(
        spaceFeatureUsageRepository.getUsageByFeatureId({
          spaceId,
          periods: [period],
        }),
      ).resolves.toStrictEqual(new Map());
    });
  });
});
