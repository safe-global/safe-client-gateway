// SPDX-License-Identifier: FSL-1.1-MIT

import { randomUUID } from 'node:crypto';
import { faker } from '@faker-js/faker';
import type { ConfigService } from '@nestjs/config';
import { DataSource, type ObjectLiteral } from 'typeorm';
import type { MockedObject } from 'vitest';
import configuration from '@/config/entities/__tests__/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import type { SubscriptionStatus } from '@/datasources/billing-api/entities/subscription.entity';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import type { ILoggingService } from '@/logging/logging.interface';
import { Feature } from '@/modules/entitlements/datasources/entities/feature.entity.db';
import { SpaceFeatureUsage } from '@/modules/entitlements/datasources/entities/space-feature-usage.entity.db';
import { SpaceSubscription } from '@/modules/entitlements/datasources/entities/space-subscription.entity.db';
import { SubscriptionEntitlement } from '@/modules/entitlements/datasources/entities/subscription-entitlement.entity.db';
import { SubscriptionsRepository } from '@/modules/entitlements/domain/subscriptions.repository';
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

describe('SubscriptionsRepository', () => {
  let postgresDatabaseService: PostgresDatabaseService;
  let subscriptionsRepository: SubscriptionsRepository;

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

    subscriptionsRepository = new SubscriptionsRepository(
      postgresDatabaseService,
    );
  });

  afterEach(async () => {
    vi.resetAllMocks();

    // Delete in dependency order; the subscription rows reference the space.
    await deleteAll(SpaceSubscription);
    await deleteAll(Space);
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

  // The status is what each case is about; the rest of the row is incidental.
  // Returns the plan id written, so a case can assert what it reads back.
  async function subscribe(
    spaceId: Space['id'],
    status: SubscriptionStatus,
    planId: string = faker.string.uuid(),
  ): Promise<string> {
    await subscriptionsRepository.upsertSubscription({
      spaceId,
      upstreamSubscriptionId: faker.string.uuid(),
      values: {
        status,
        planId,
        planName: nameBuilder(),
        planCode: faker.string.alphanumeric(8),
        currentPeriodStart: null,
        currentPeriodEnd: null,
        lastEventAt: null,
      },
    });
    return planId;
  }

  describe('getSubscriptionSummary', () => {
    it('should report a space that never subscribed', async () => {
      const spaceId = await createSpace();

      await expect(
        subscriptionsRepository.getSubscriptionSummary(spaceId),
      ).resolves.toStrictEqual({
        hasEverSubscribed: false,
        activePlanId: null,
      });
    });

    it.each(['active', 'trialing'] as const)(
      'should report the plan id of a %s subscription',
      async (status) => {
        const spaceId = await createSpace();
        const planId = await subscribe(spaceId, status);

        await expect(
          subscriptionsRepository.getSubscriptionSummary(spaceId),
        ).resolves.toStrictEqual({
          hasEverSubscribed: true,
          activePlanId: planId,
        });
      },
    );

    // Every status outside ACTIVE_SUBSCRIPTION_STATUSES, listed literally
    // rather than derived from it: the point is to pin which side of the line
    // each one falls on, which a list computed from that constant could not do.
    it.each([
      'canceled',
      'incomplete',
      'incomplete_expired',
      'past_due',
      'paused',
      'unpaid',
    ] as const)(
      'should report a %s subscription as subscribed but on no plan',
      async (status) => {
        const spaceId = await createSpace();
        await subscribe(spaceId, status);

        await expect(
          subscriptionsRepository.getSubscriptionSummary(spaceId),
        ).resolves.toStrictEqual({
          hasEverSubscribed: true,
          activePlanId: null,
        });
      },
    );

    it('should keep the active plan id when a terminal row also exists', async () => {
      const spaceId = await createSpace();
      await subscribe(spaceId, 'canceled');
      const planId = await subscribe(spaceId, 'active');

      await expect(
        subscriptionsRepository.getSubscriptionSummary(spaceId),
      ).resolves.toStrictEqual({
        hasEverSubscribed: true,
        activePlanId: planId,
      });
    });

    it('should not leak another space subscriptions', async () => {
      const [spaceId, otherSpaceId] = await Promise.all([
        createSpace(),
        createSpace(),
      ]);
      await subscribe(otherSpaceId, 'active');

      await expect(
        subscriptionsRepository.getSubscriptionSummary(spaceId),
      ).resolves.toStrictEqual({
        hasEverSubscribed: false,
        activePlanId: null,
      });
    });
  });
});
