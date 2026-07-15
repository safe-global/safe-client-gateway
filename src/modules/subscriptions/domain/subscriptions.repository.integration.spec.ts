// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import { DataSource } from 'typeorm';
import type { MockedObject } from 'vitest';
import configuration from '@/config/entities/__tests__/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import type { ILoggingService } from '@/logging/logging.interface';
import { SpaceSafe } from '@/modules/spaces/datasources/safes/entities/space-safes.entity.db';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { SpaceStatus } from '@/modules/spaces/domain/entities/space.entity';
import { Subscription } from '@/modules/subscriptions/datasources/entities/subscription.entity.db';
import { SubscriptionStatuses } from '@/modules/subscriptions/domain/entities/subscription.entity';
import { SubscriptionsRepository } from '@/modules/subscriptions/domain/subscriptions.repository';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';

const mockLoggingService = {
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

const SpaceStatusKeys = getStringEnumKeys(SpaceStatus);

function subscriptionEventArgs(
  overrides: Partial<
    Parameters<SubscriptionsRepository['upsertFromEvent']>[0]
  > = {},
) {
  return {
    id: faker.string.uuid(),
    spaceId: faker.number.int({ max: 1_000_000 }),
    status: faker.helpers.arrayElement(SubscriptionStatuses),
    metadata: { price: faker.number.int().toString() },
    lastEventId: faker.string.uuid(),
    lastEventOccurredAt: faker.date.recent(),
    ...overrides,
  };
}

describe('SubscriptionsRepository', () => {
  let postgresDatabaseService: PostgresDatabaseService;
  let subscriptionsRepo: SubscriptionsRepository;
  let dbSpaceRepository: Repository<Space>;
  let dbSubscriptionsRepository: Repository<Subscription>;

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
    entities: [Member, Space, SpaceSafe, Subscription, User, Wallet],
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

    subscriptionsRepo = new SubscriptionsRepository(postgresDatabaseService);

    dbSpaceRepository = dataSource.getRepository(Space);
    dbSubscriptionsRepository = dataSource.getRepository(Subscription);
  });

  afterEach(async () => {
    vi.resetAllMocks();

    // Delete in dependency order to avoid deadlocks
    await dbSubscriptionsRepository
      .createQueryBuilder()
      .delete()
      .where('1=1')
      .execute();
    await dbSpaceRepository
      .createQueryBuilder()
      .delete()
      .where('1=1')
      .execute();
  });

  afterAll(async () => {
    await postgresDatabaseService.getDataSource().dropDatabase();
    await postgresDatabaseService.destroyDatabaseConnection();
  });

  async function createSpace(): Promise<Space['id']> {
    const space = await dbSpaceRepository.insert({
      status: faker.helpers.arrayElement(SpaceStatusKeys),
      name: faker.word.noun(),
    });
    return space.identifiers[0].id as Space['id'];
  }

  describe('upsertFromEvent', () => {
    it('should insert a new subscription', async () => {
      const spaceId = await createSpace();
      const args = subscriptionEventArgs({ spaceId });

      await subscriptionsRepo.upsertFromEvent(args);

      const subscription = await dbSubscriptionsRepository.findOneOrFail({
        where: { id: args.id },
      });

      expect(subscription).toMatchObject({
        id: args.id,
        status: args.status,
        metadata: args.metadata,
        lastEventId: args.lastEventId,
      });
    });

    it('should update an existing subscription when the event is newer', async () => {
      const spaceId = await createSpace();
      const initial = subscriptionEventArgs({
        spaceId,
        lastEventOccurredAt: faker.date.past(),
      });
      await subscriptionsRepo.upsertFromEvent(initial);

      const update = subscriptionEventArgs({
        id: initial.id,
        spaceId,
        status: 'canceled',
        lastEventId: faker.string.uuid(),
        lastEventOccurredAt: faker.date.future(),
      });
      await subscriptionsRepo.upsertFromEvent(update);

      const subscription = await dbSubscriptionsRepository.findOneOrFail({
        where: { id: initial.id },
      });

      expect(subscription.status).toEqual('canceled');
      expect(subscription.lastEventId).toEqual(update.lastEventId);
    });

    it('should ignore a retried event with the same last_event_id', async () => {
      const spaceId = await createSpace();
      const initial = subscriptionEventArgs({ spaceId, status: 'active' });
      await subscriptionsRepo.upsertFromEvent(initial);

      const retry = subscriptionEventArgs({
        id: initial.id,
        spaceId,
        status: 'canceled',
        lastEventId: initial.lastEventId,
        lastEventOccurredAt: initial.lastEventOccurredAt,
      });
      await subscriptionsRepo.upsertFromEvent(retry);

      const subscription = await dbSubscriptionsRepository.findOneOrFail({
        where: { id: initial.id },
      });

      expect(subscription.status).toEqual('active');
    });

    it('should ignore an out-of-order event with an older occurred_at', async () => {
      const spaceId = await createSpace();
      const initial = subscriptionEventArgs({
        spaceId,
        status: 'active',
        lastEventOccurredAt: faker.date.future(),
      });
      await subscriptionsRepo.upsertFromEvent(initial);

      const staleEvent = subscriptionEventArgs({
        id: initial.id,
        spaceId,
        status: 'canceled',
        lastEventId: faker.string.uuid(),
        lastEventOccurredAt: faker.date.past(),
      });
      await subscriptionsRepo.upsertFromEvent(staleEvent);

      const subscription = await dbSubscriptionsRepository.findOneOrFail({
        where: { id: initial.id },
      });

      expect(subscription.status).toEqual('active');
      expect(subscription.lastEventId).toEqual(initial.lastEventId);
    });
  });

  describe('findBySpaceId', () => {
    it('should return the subscription for the given space', async () => {
      const spaceId = await createSpace();
      const args = subscriptionEventArgs({ spaceId });
      await subscriptionsRepo.upsertFromEvent(args);

      const subscriptions = await subscriptionsRepo.findBySpaceId(spaceId);

      expect(subscriptions.map((s) => s.id)).toEqual([args.id]);
    });

    it('should return all subscriptions for a space with more than one', async () => {
      const spaceId = await createSpace();
      const first = subscriptionEventArgs({ spaceId });
      const second = subscriptionEventArgs({ spaceId });
      await subscriptionsRepo.upsertFromEvent(first);
      await subscriptionsRepo.upsertFromEvent(second);

      const subscriptions = await subscriptionsRepo.findBySpaceId(spaceId);

      expect(subscriptions.map((s) => s.id).sort()).toEqual(
        [first.id, second.id].sort(),
      );
    });

    it('should return an empty array if no subscription is found', async () => {
      const spaceId = await createSpace();

      await expect(subscriptionsRepo.findBySpaceId(spaceId)).resolves.toEqual(
        [],
      );
    });
  });

  describe('findById', () => {
    it('should return the subscription by id', async () => {
      const spaceId = await createSpace();
      const args = subscriptionEventArgs({ spaceId });
      await subscriptionsRepo.upsertFromEvent(args);

      const subscription = await subscriptionsRepo.findById(args.id);

      expect(subscription?.id).toEqual(args.id);
    });

    it('should return null if no subscription is found', async () => {
      await expect(
        subscriptionsRepo.findById(faker.string.uuid()),
      ).resolves.toBeNull();
    });
  });
});
