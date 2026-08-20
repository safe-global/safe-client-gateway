// SPDX-License-Identifier: FSL-1.1-MIT

import { randomUUID } from 'node:crypto';
import { faker } from '@faker-js/faker';
import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DataSource, type EntityManager } from 'typeorm';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import configuration from '@/config/entities/__tests__/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import type { ILoggingService } from '@/logging/logging.interface';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Feature } from '@/modules/entitlements/datasources/entities/feature.entity.db';
import { SpaceFeatureUsage } from '@/modules/entitlements/datasources/entities/space-feature-usage.entity.db';
import { SpaceSubscription } from '@/modules/entitlements/datasources/entities/space-subscription.entity.db';
import { SubscriptionEntitlement } from '@/modules/entitlements/datasources/entities/subscription-entitlement.entity.db';
import { featureBuilder } from '@/modules/entitlements/domain/entities/__tests__/feature.builder';
import {
  materializedSubscriptionBuilder,
  parsedEntitlementBuilder,
} from '@/modules/entitlements/domain/entities/__tests__/materialized-subscription.builder';
import type { FeatureKey } from '@/modules/entitlements/domain/entities/feature.entity';
import {
  FEATURE_KEYS,
  FeatureType,
} from '@/modules/entitlements/domain/entities/feature.entity';
import type { MaterializedSubscription } from '@/modules/entitlements/domain/entities/materialized-subscription.entity';
import { isStockMeteredFeature } from '@/modules/entitlements/domain/entitlements.constants';
import { FeaturesRepository } from '@/modules/entitlements/domain/features.repository';
import { SpaceFeatureUsageRepository } from '@/modules/entitlements/domain/space-feature-usage.repository';
import { SubscriptionEntitlementsRepository } from '@/modules/entitlements/domain/subscription-entitlements.repository';
import { SubscriptionsRepository } from '@/modules/entitlements/domain/subscriptions.repository';
import { EntitlementsService } from '@/modules/entitlements/routes/entitlements.service';
import { SpaceSafe } from '@/modules/spaces/datasources/safes/entities/space-safes.entity.db';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import type { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import type { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';

const mockLoggingService = {
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

// The suite owns its catalog: only `safe_seats` is signed off and seeded by a
// migration, so the branches below are exercised against fixtures rather than
// the shipped catalog. The fixtures below cover every resolution branch
// the repository implements — binary, value, stock-metered (usage is a live
// COUNT over an existing table) and event-metered (usage is a period-keyed
// `space_feature_usage` counter). Keys come from the real `FeatureKey` enum
// because the repository dispatches stock counting by key.
const FREE_SAFE_SEATS = 2;
const SPONSORED_PERIOD_DAYS = 30;

const FEATURE_FIXTURES = [
  featureBuilder()
    .with('key', 'security_hub')
    .with('type', FeatureType.Binary)
    .with('freeEnabled', false)
    .build(),
  // A second binary, never purchased by any test, so the "unpurchased feature
  // falls back to the Free default" branch stays covered.
  featureBuilder()
    .with('key', 'pay_from_safe')
    .with('type', FeatureType.Binary)
    .with('freeEnabled', false)
    .build(),
  // `resetsAt` is null by key here: seats are stock-metered.
  featureBuilder()
    .with('key', 'safe_seats')
    .with('type', FeatureType.Metered)
    .with('freeEnabled', true)
    .with('freeQuota', FREE_SAFE_SEATS)
    .build(),
  // Free-disabled by default so the "disabled admits no usage" path is
  // covered; the `consume` tests enable it explicitly.
  featureBuilder()
    .with('key', 'sponsored_transactions')
    .with('type', FeatureType.Metered)
    .with('freeEnabled', false)
    .with('freeQuota', 0)
    .with('freePeriod', SPONSORED_PERIOD_DAYS)
    .build(),
  featureBuilder()
    .with('key', 'swap_fee_tier')
    .with('type', FeatureType.Value)
    .with('freeEnabled', true)
    .with('freeValue', 'free')
    .build(),
];

// Ordering stamps are asserted on and compared against each other, so they
// stay literal rather than faker-random.
const FIRST_STAMP = new Date('2026-08-17T12:00:00.000Z');

describe('EntitlementsService', () => {
  let postgresDatabaseService: PostgresDatabaseService;
  // The service composes the per-table repositories; exercised here against
  // the real database so queries and derivation rules are covered end to end.
  let service: EntitlementsService;
  let subscriptionsRepository: SubscriptionsRepository;
  let seededFeatureKeys: Array<FeatureKey> = [];

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
      Member,
      Space,
      SpaceSafe,
      User,
      Wallet,
      Feature,
      SpaceSubscription,
      SubscriptionEntitlement,
      SpaceFeatureUsage,
    ],
  });

  // Stubs for the collaborating modules' repositories: thin adapters over the
  // same test database, so the queries they stand in for still run for real.
  // Their production implementations are covered by their own specs.
  const spacesRepositoryStub = {
    findOne: async (args: Parameters<ISpacesRepository['findOne']>[0]) =>
      await dataSource.getRepository(Space).findOne(args),
    findUuidById: async (id: Space['id']): Promise<Space['uuid']> => {
      const space = await dataSource
        .getRepository(Space)
        .findOne({ where: { id }, select: { uuid: true } });
      if (!space) throw new NotFoundException('Workspace not found.');
      return space.uuid;
    },
  } as unknown as ISpacesRepository;

  const spaceSafesRepositoryStub = {
    countBySpaceId: async (spaceId: number, entityManager?: EntityManager) =>
      await (entityManager ?? dataSource.manager).count(SpaceSafe, {
        where: { space: { id: spaceId } },
      }),
  } as unknown as ISpaceSafesRepository;

  const membersRepositoryStub = {
    findOne: async (where: Parameters<IMembersRepository['findOne']>[0]) =>
      await dataSource.getRepository(Member).findOne({ where }),
  } as unknown as IMembersRepository;

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
    seededFeatureKeys = (
      await dataSource.getRepository(Feature).find({ select: { key: true } })
    ).map((feature) => feature.key);
    await dataSource
      .getRepository(Feature)
      .createQueryBuilder()
      .delete()
      .execute();

    subscriptionsRepository = new SubscriptionsRepository(
      postgresDatabaseService,
    );
    service = new EntitlementsService(
      new FeaturesRepository(postgresDatabaseService),
      subscriptionsRepository,
      new SubscriptionEntitlementsRepository(postgresDatabaseService),
      new SpaceFeatureUsageRepository(postgresDatabaseService),
      spacesRepositoryStub,
      spaceSafesRepositoryStub,
      membersRepositoryStub,
      postgresDatabaseService,
      mockLoggingService,
    );
  });

  // Pristine catalog per test: some tests mutate feature rows (changing the
  // Free tier is an UPDATE on the catalog, per the RFC).
  beforeEach(async () => {
    await dataSource.getRepository(Feature).insert(FEATURE_FIXTURES);
  });

  afterEach(async () => {
    // Delete in dependency order; `features` last, as the usage and
    // entitlement rows reference it with ON DELETE RESTRICT.
    await dataSource
      .getRepository(SpaceFeatureUsage)
      .createQueryBuilder()
      .delete()
      .execute();
    await dataSource
      .getRepository(SubscriptionEntitlement)
      .createQueryBuilder()
      .delete()
      .execute();
    await dataSource
      .getRepository(SpaceSubscription)
      .createQueryBuilder()
      .delete()
      .execute();
    await dataSource
      .getRepository(Member)
      .createQueryBuilder()
      .delete()
      .execute();
    await dataSource
      .getRepository(SpaceSafe)
      .createQueryBuilder()
      .delete()
      .execute();
    await dataSource
      .getRepository(Space)
      .createQueryBuilder()
      .delete()
      .execute();
    await dataSource
      .getRepository(Wallet)
      .createQueryBuilder()
      .delete()
      .execute();
    await dataSource
      .getRepository(User)
      .createQueryBuilder()
      .delete()
      .execute();
    await dataSource
      .getRepository(Feature)
      .createQueryBuilder()
      .delete()
      .execute();
  });

  afterAll(async () => {
    await postgresDatabaseService.getDataSource().dropDatabase();
    await postgresDatabaseService.destroyDatabaseConnection();
  });

  async function createSpace(): Promise<number> {
    const inserted = await dataSource.getRepository(Space).insert({
      name: faker.company.name(),
      status: 'ACTIVE',
    });
    return inserted.generatedMaps[0].id as number;
  }

  async function addSafes(spaceId: number, count: number): Promise<void> {
    const base = Date.now() - count * 60_000;
    for (let i = 0; i < count; i++) {
      await dataSource.getRepository(SpaceSafe).insert({
        space: { id: spaceId },
        chainId: '1',
        address: getAddress(faker.finance.ethereumAddress()),
        addressIndex: null,
        createdAt: new Date(base + i * 60_000),
      });
    }
  }

  async function addMember(
    spaceId: number,
    status: 'ACTIVE' | 'INVITED' | 'DECLINED',
    inviteExpiresAt?: Date,
    role: 'ADMIN' | 'MEMBER' = 'MEMBER',
  ): Promise<number> {
    const user = await dataSource.getRepository(User).insert({
      status: 'ACTIVE',
    });
    const userId = user.generatedMaps[0].id as number;
    await dataSource.getRepository(Member).insert({
      user: { id: userId },
      space: { id: spaceId },
      name: faker.person.firstName(),
      role,
      status,
      inviteExpiresAt:
        status === 'INVITED' ? (inviteExpiresAt ?? faker.date.future()) : null,
    });
    return userId;
  }

  function authPayloadFor(userId: number): AuthPayload {
    return new AuthPayload(
      siweAuthPayloadDtoBuilder().with('sub', String(userId)).build(),
    );
  }

  function seatsOf<T extends { feature: FeatureKey }>(result: {
    entitlements: Array<T>;
  }): T | undefined {
    return result.entitlements.find(
      (entitlement) => entitlement.feature === 'safe_seats',
    );
  }

  function materializedSubscription(
    overrides?: Partial<MaterializedSubscription>,
  ): MaterializedSubscription {
    return {
      upstreamSubscriptionId: faker.string.uuid(),
      status: 'active',
      planId: 'business',
      planName: 'Business',
      currentPeriodStart: new Date('2026-07-01T00:00:00Z'),
      currentPeriodEnd: new Date('2026-08-01T00:00:00Z'),
      entitlements: [],
      ...overrides,
    };
  }

  let stampSequence = 0;
  function nextStamp(): Date {
    stampSequence += 1;
    return new Date(FIRST_STAMP.getTime() + stampSequence * 1_000);
  }

  async function materializeFromEvent(args: {
    spaceId: number;
    subscription: MaterializedSubscription;
    eventAt?: Date;
  }): Promise<boolean> {
    return await service.materializeFromEvent({
      spaceId: args.spaceId,
      subscription: args.subscription,
      eventAt: args.eventAt ?? nextStamp(),
    });
  }

  async function materializeAuthoritative(args: {
    spaceId: number;
    subscriptions: Array<MaterializedSubscription>;
    triggerEventAt?: Date | null;
    observedEventAt?: Date | null;
  }): Promise<boolean> {
    return await service.materializeAuthoritative({
      spaceId: args.spaceId,
      subscriptions: args.subscriptions,
      triggerEventAt:
        args.triggerEventAt === undefined ? nextStamp() : args.triggerEventAt,
      // What a real caller observes before it fetches, read through the same
      // query it uses — a case simulating a concurrent write passes its own.
      observedEventAt:
        args.observedEventAt === undefined
          ? await subscriptionsRepository.getLastEventAt(args.spaceId)
          : args.observedEventAt,
    });
  }

  async function getSubscriptions(): Promise<Array<SpaceSubscription>> {
    return await dataSource.getRepository(SpaceSubscription).find({
      relations: { entitlements: { feature: true } },
      order: { id: 'ASC' },
    });
  }

  describe('feature catalog fixtures', () => {
    // The DB-vs-catalog drift guard belongs with the seed migration, which
    // ships once product signs the real values off. What matters here is that
    // the fixtures round-trip correctly and stay an exhaustive sample of the
    // catalog.
    it('round-trips fixture types through the database and covers every feature type', async () => {
      const features = await dataSource.getRepository(Feature).find();
      const typeByKey = new Map(
        FEATURE_FIXTURES.map((fixture) => [fixture.key, fixture.type]),
      );

      expect(features).toHaveLength(FEATURE_FIXTURES.length);
      for (const feature of features) {
        expect(feature.type).toBe(typeByKey.get(feature.key));
      }
      expect(new Set(features.map((feature) => feature.type))).toStrictEqual(
        new Set(Object.values(FeatureType)),
      );
    });

    it('covers both metered flavors: stock-counted and event-counted', () => {
      const metered = FEATURE_FIXTURES.filter(
        (fixture) => fixture.type === 'metered',
      );

      expect(
        metered.filter((fixture) => isStockMeteredFeature(fixture)),
      ).not.toHaveLength(0);
      expect(
        metered.filter((fixture) => !isStockMeteredFeature(fixture)),
      ).not.toHaveLength(0);
    });
  });

  it('publishes every feature key the migrations seed', () => {
    expect([...seededFeatureKeys].sort()).toStrictEqual(
      [...FEATURE_KEYS].sort(),
    );
  });

  describe('resolveEntitlements', () => {
    it('resolves the Free branch from catalog defaults when no subscription exists', async () => {
      const spaceId = await createSpace();
      await addSafes(spaceId, 2);

      const result = await service.resolveEntitlements(spaceId);

      expect(result.plan).toBeNull();
      // One resolved entitlement per catalog row, always.
      expect(result.entitlements).toHaveLength(FEATURE_FIXTURES.length);

      const byFeature = new Map(
        result.entitlements.map((entitlement) => [
          entitlement.feature,
          entitlement,
        ]),
      );
      expect(byFeature.get('safe_seats')).toStrictEqual({
        feature: 'safe_seats',
        type: FeatureType.Metered,
        enabled: true,
        quota: FREE_SAFE_SEATS,
        used: 2,
        overLimit: false,
        resetsAt: null,
      });
      expect(byFeature.get('security_hub')).toStrictEqual({
        feature: 'security_hub',
        type: FeatureType.Binary,
        enabled: false,
      });
      expect(byFeature.get('swap_fee_tier')).toStrictEqual({
        feature: 'swap_fee_tier',
        type: FeatureType.Value,
        enabled: true,
        value: 'free',
      });
      // Event-metered on the Free tier: disabled, so no usage is admitted.
      expect(byFeature.get('sponsored_transactions')).toMatchObject({
        type: FeatureType.Metered,
        enabled: false,
        quota: 0,
        used: 0,
      });
    });

    it('resolves the paid branch with Free fallback for unpurchased features', async () => {
      const spaceId = await createSpace();
      const subscription = materializedSubscription({
        entitlements: [
          { featureKey: 'safe_seats', enabled: true, quota: 20, value: null },
          {
            featureKey: 'security_hub',
            enabled: true,
            quota: null,
            value: null,
          },
          {
            featureKey: 'swap_fee_tier',
            enabled: true,
            quota: null,
            value: 'business',
          },
          {
            featureKey: 'sponsored_transactions',
            enabled: true,
            quota: null,
            value: null,
          },
        ],
      });
      await materializeAuthoritative({
        spaceId,
        subscriptions: [subscription],
      });

      const result = await service.resolveEntitlements(spaceId);

      expect(result.plan).toStrictEqual({
        id: 'business',
        name: 'Business',
        cycleEndsAt: new Date('2026-08-01T00:00:00Z'),
      });
      const byFeature = new Map(
        result.entitlements.map((entitlement) => [
          entitlement.feature,
          entitlement,
        ]),
      );
      expect(byFeature.get('safe_seats')).toMatchObject({ quota: 20 });
      expect(byFeature.get('security_hub')).toMatchObject({ enabled: true });
      expect(byFeature.get('swap_fee_tier')).toMatchObject({
        value: 'business',
      });
      // Unlimited: quota null, and the reset anchors on the billing cycle.
      expect(byFeature.get('sponsored_transactions')).toMatchObject({
        quota: null,
        resetsAt: new Date('2026-08-01T00:00:00Z'),
      });
      // Not purchased → Free defaults.
      expect(byFeature.get('pay_from_safe')).toMatchObject({ enabled: false });
    });

    it('reports usage over the Free quota without inflating it', async () => {
      const spaceId = await createSpace();
      await addSafes(spaceId, FREE_SAFE_SEATS + 2);

      const result = await service.resolveEntitlements(spaceId);

      // Quota is never inflated; used > quota is legal, and that legal state is
      // what the endpoint names as over-limit.
      expect(seatsOf(result)).toMatchObject({
        quota: FREE_SAFE_SEATS,
        used: FREE_SAFE_SEATS + 2,
        overLimit: true,
      });
    });

    it('reports no over-limit feature when the plan grants an unlimited quota', async () => {
      const spaceId = await createSpace();
      await addSafes(spaceId, FREE_SAFE_SEATS + 2);
      await materializeAuthoritative({
        spaceId,
        subscriptions: [
          materializedSubscription({
            upstreamSubscriptionId: 'sub_unlimited',
            entitlements: [
              {
                featureKey: 'safe_seats',
                enabled: true,
                quota: null,
                value: null,
              },
            ],
          }),
        ],
      });

      const result = await service.resolveEntitlements(spaceId);

      expect(seatsOf(result)).toMatchObject({
        quota: null,
        used: FREE_SAFE_SEATS + 2,
        overLimit: false,
      });
    });

    it('falls back to the Free quota once the subscription is canceled', async () => {
      const spaceId = await createSpace();
      await addSafes(spaceId, FREE_SAFE_SEATS + 1);

      // Buy a plan above usage, then cancel it.
      await materializeAuthoritative({
        spaceId,
        subscriptions: [
          materializedSubscription({
            upstreamSubscriptionId: 'sub_1',
            entitlements: [
              {
                featureKey: 'safe_seats',
                enabled: true,
                quota: 5,
                value: null,
              },
            ],
          }),
        ],
      });
      await materializeAuthoritative({
        spaceId,
        subscriptions: [
          materializedSubscription({
            upstreamSubscriptionId: 'sub_1',
            status: 'canceled',
            entitlements: null,
          }),
        ],
      });

      const result = await service.resolveEntitlements(spaceId);

      expect(seatsOf(result)).toMatchObject({
        quota: FREE_SAFE_SEATS,
        used: 3,
        overLimit: true,
      });
    });
  });

  describe('materialize', () => {
    it('writes the subscription and its purchased package', async () => {
      const spaceId = await createSpace();
      const subscription = materializedSubscriptionBuilder()
        .with('status', 'active')
        .with('planId', 'business')
        .with('planName', 'Business')
        .with('currentPeriodStart', new Date('2026-07-01T00:00:00Z'))
        .with('currentPeriodEnd', new Date('2026-08-01T00:00:00Z'))
        .with('entitlements', [
          { featureKey: 'safe_seats', enabled: true, quota: 10, value: null },
          {
            featureKey: 'swap_fee_tier',
            enabled: true,
            quota: null,
            value: 'business',
          },
        ])
        .build();

      await materializeFromEvent({ spaceId, subscription });

      const [persisted] = await getSubscriptions();
      expect(persisted).toMatchObject({
        upstreamSubscriptionId: subscription.upstreamSubscriptionId,
        status: 'active',
        planId: 'business',
        planName: 'Business',
        currentPeriodStart: new Date('2026-07-01T00:00:00Z'),
        currentPeriodEnd: new Date('2026-08-01T00:00:00Z'),
      });
      expect(
        (persisted.entitlements ?? []).map((entitlement) => ({
          feature: entitlement.feature.key,
          enabled: entitlement.enabled,
          quota: entitlement.quota,
          value: entitlement.value,
        })),
      ).toStrictEqual(
        expect.arrayContaining([
          {
            feature: 'safe_seats',
            enabled: true,
            quota: 10,
            value: null,
          },
          {
            feature: 'swap_fee_tier',
            enabled: true,
            quota: null,
            value: 'business',
          },
        ]),
      );
    });

    it('drops package entries whose feature is not in the catalog', async () => {
      const spaceId = await createSpace();
      const subscription = materializedSubscriptionBuilder()
        .with('status', 'active')
        .with('entitlements', [
          parsedEntitlementBuilder().with('featureKey', 'safe_seats').build(),
          parsedEntitlementBuilder()
            .with('featureKey', 'not_in_the_catalog')
            .build(),
        ])
        .build();

      await materializeFromEvent({ spaceId, subscription });

      const [persisted] = await getSubscriptions();
      expect(persisted.entitlements).toHaveLength(1);
      expect(persisted.entitlements?.[0].feature.key).toBe('safe_seats');
    });

    it('is idempotent: reprocessing the same state yields the same rows', async () => {
      const spaceId = await createSpace();
      const subscription = materializedSubscriptionBuilder()
        .with('status', 'active')
        .with('entitlements', [
          parsedEntitlementBuilder().with('featureKey', 'safe_seats').build(),
          parsedEntitlementBuilder().with('featureKey', 'security_hub').build(),
        ])
        .build();

      await materializeFromEvent({ spaceId, subscription });
      await materializeFromEvent({ spaceId, subscription });

      expect(await dataSource.getRepository(SpaceSubscription).count()).toBe(1);
      expect(
        await dataSource.getRepository(SubscriptionEntitlement).count(),
      ).toBe(2);
    });

    it('replaces the active slot on upgrade, keeping the old subscription as history', async () => {
      const spaceId = await createSpace();
      const oldSubscription = materializedSubscriptionBuilder()
        .with('status', 'active')
        .with('planId', 'starter')
        .with('entitlements', [
          parsedEntitlementBuilder()
            .with('featureKey', 'safe_seats')
            .with('quota', 5)
            .build(),
        ])
        .build();
      await materializeFromEvent({ spaceId, subscription: oldSubscription });

      // Upgrade: the old subscription cancels, a new one becomes active. The
      // slot must be freed before the promotion is written, or the "one active
      // subscription per space" partial unique index rejects the batch.
      const newSubscription = materializedSubscriptionBuilder()
        .with('status', 'active')
        .with('planId', 'business')
        .with('entitlements', [
          parsedEntitlementBuilder()
            .with('featureKey', 'safe_seats')
            .with('quota', 20)
            .build(),
        ])
        .build();
      await materializeAuthoritative({
        spaceId,
        subscriptions: [
          { ...oldSubscription, status: 'canceled', entitlements: null },
          newSubscription,
        ],
      });

      const subscriptions = await getSubscriptions();
      expect(subscriptions).toHaveLength(2);

      const byUpstreamId = new Map(
        subscriptions.map((subscription) => [
          subscription.upstreamSubscriptionId,
          subscription,
        ]),
      );
      // The outgoing subscription keeps its row, and its old package, as
      // history — the RFC requires this as an audit trail, not a bug: an
      // effective package is always read through the active subscription,
      // so the stale entitlements below are inert, never re-surfaced.
      const outgoing = byUpstreamId.get(oldSubscription.upstreamSubscriptionId);
      expect(outgoing).toMatchObject({ status: 'canceled', planId: 'starter' });
      expect(outgoing?.entitlements).toHaveLength(1);
      expect(outgoing?.entitlements?.[0]).toMatchObject({ quota: 5 });
      const incoming = byUpstreamId.get(newSubscription.upstreamSubscriptionId);
      expect(incoming).toMatchObject({ status: 'active', planId: 'business' });
      expect(incoming?.entitlements).toHaveLength(1);
      expect(incoming?.entitlements?.[0]).toMatchObject({ quota: 20 });
    });

    it('accepts a batch that lists the promotion before the demotion', async () => {
      const spaceId = await createSpace();
      const oldSubscription = materializedSubscriptionBuilder()
        .with('status', 'active')
        .with('entitlements', [
          parsedEntitlementBuilder().with('featureKey', 'safe_seats').build(),
        ])
        .build();
      await materializeFromEvent({ spaceId, subscription: oldSubscription });

      // Same upgrade as above, but with the incoming (active) subscription
      // listed FIRST: input order must not matter, which only holds because
      // materialize() frees the slot up front. Writing the batch in the given
      // order alone would violate the "one active per space" partial unique
      // index on the promotion's INSERT.
      const newSubscription = materializedSubscriptionBuilder()
        .with('status', 'active')
        .with('entitlements', [
          parsedEntitlementBuilder().with('featureKey', 'safe_seats').build(),
        ])
        .build();
      await materializeAuthoritative({
        spaceId,
        subscriptions: [
          newSubscription,
          { ...oldSubscription, status: 'canceled', entitlements: null },
        ],
      });

      const subscriptions = await getSubscriptions();
      const byUpstreamId = new Map(
        subscriptions.map((subscription) => [
          subscription.upstreamSubscriptionId,
          subscription,
        ]),
      );
      expect(
        byUpstreamId.get(oldSubscription.upstreamSubscriptionId),
      ).toMatchObject({
        status: 'canceled',
      });
      expect(
        byUpstreamId.get(newSubscription.upstreamSubscriptionId),
      ).toMatchObject({ status: 'active' });
    });

    // Only `active`/`trialing` hold the slot, so a payment-failed subscription
    // must not block the one replacing it — the partial unique index and
    // ACTIVE_SUBSCRIPTION_STATUSES have to agree on exactly which statuses do.
    it('lets a new subscription take the slot a past_due one does not hold', async () => {
      const spaceId = await createSpace();
      const pastDue = materializedSubscriptionBuilder()
        .with('status', 'past_due')
        .with('entitlements', null)
        .build();
      await materializeFromEvent({ spaceId, subscription: pastDue });

      const incoming = materializedSubscriptionBuilder()
        .with('status', 'active')
        .with('entitlements', [
          parsedEntitlementBuilder().with('featureKey', 'safe_seats').build(),
        ])
        .build();

      await expect(
        materializeFromEvent({ spaceId, subscription: incoming }),
      ).resolves.toBe(true);

      const rows = await dataSource
        .getRepository(SpaceSubscription)
        .find({ where: { space: { id: spaceId } } });
      expect(
        rows.map((row) => [row.upstreamSubscriptionId, row.status]),
      ).toStrictEqual(
        expect.arrayContaining([
          [pastDue.upstreamSubscriptionId, 'past_due'],
          [incoming.upstreamSubscriptionId, 'active'],
        ]),
      );
    });

    // A single event speaks only for its own subscription: the others are none
    // of its business, however stale they look.
    it('leaves other active rows alone when the state comes from one event', async () => {
      const spaceId = await createSpace();
      const active = materializedSubscriptionBuilder()
        .with('status', 'active')
        .with('entitlements', null)
        .build();
      await materializeFromEvent({ spaceId, subscription: active });

      const unrelated = materializedSubscriptionBuilder()
        .with('status', 'canceled')
        .with('entitlements', null)
        .build();
      await materializeFromEvent({ spaceId, subscription: unrelated });

      const rows = await dataSource
        .getRepository(SpaceSubscription)
        .find({ where: { space: { id: spaceId } } });
      expect(
        rows.map((row) => [row.upstreamSubscriptionId, row.status]),
      ).toStrictEqual(
        expect.arrayContaining([
          [active.upstreamSubscriptionId, 'active'],
          [unrelated.upstreamSubscriptionId, 'canceled'],
        ]),
      );
    });

    it('rejects an unknown workspace', async () => {
      await expect(
        materializeAuthoritative({
          spaceId: faker.number.int({ min: 100_000, max: 1_000_000 }),
          subscriptions: [materializedSubscriptionBuilder().build()],
        }),
      ).rejects.toThrow('Workspace not found.');
    });

    it('rejects a batch with more than one subscription carrying a package', async () => {
      const spaceId = await createSpace();

      await expect(
        materializeAuthoritative({
          spaceId,
          subscriptions: [
            materializedSubscriptionBuilder()
              .with('entitlements', [
                parsedEntitlementBuilder()
                  .with('featureKey', 'safe_seats')
                  .build(),
              ])
              .build(),
            materializedSubscriptionBuilder()
              .with('entitlements', [
                parsedEntitlementBuilder()
                  .with('featureKey', 'safe_seats')
                  .build(),
              ])
              .build(),
          ],
        }),
      ).rejects.toThrow('expected at most 1');
      // Rejected before any write.
      expect(await dataSource.getRepository(SpaceSubscription).count()).toBe(0);
    });
  });

  describe('event ordering', () => {
    const olderStamp = FIRST_STAMP;
    const newerStamp = new Date(FIRST_STAMP.getTime() + 10_000);

    it('stamps every row it writes with the event behind it', async () => {
      const spaceId = await createSpace();
      const subscription = materializedSubscriptionBuilder()
        .with('status', 'active')
        .with('entitlements', null)
        .build();

      await materializeFromEvent({
        spaceId,
        subscription: subscription,
        eventAt: newerStamp,
      });

      const [persisted] = await getSubscriptions();
      expect(persisted.lastEventAt).toStrictEqual(newerStamp);
    });

    // The subscription.updated-after-subscription.deleted case, at the write
    // boundary: the payload would resurrect the subscription and restore the
    // package the deletion took away.
    // A tie counts as not newer too: upstream stamps in whole seconds, so two
    // events of the same second are no proof of order.
    it.each([
      ['older than', olderStamp],
      ['equal to', newerStamp],
    ])('skips, and reports, a payload stamped %s the materialized state', async (_, eventAt) => {
      const spaceId = await createSpace();
      const canceled = materializedSubscriptionBuilder()
        .with('status', 'canceled')
        .with('entitlements', null)
        .build();
      await materializeFromEvent({
        spaceId,
        subscription: canceled,
        eventAt: newerStamp,
      });

      await expect(
        materializeFromEvent({
          spaceId,
          subscription: {
            ...canceled,
            status: 'active',
            entitlements: [
              parsedEntitlementBuilder()
                .with('featureKey', 'safe_seats')
                .build(),
            ],
          },
          eventAt,
        }),
      ).resolves.toBe(false);

      const [persisted] = await getSubscriptions();
      expect(persisted).toMatchObject({
        status: 'canceled',
        lastEventAt: newerStamp,
      });
      expect(persisted.entitlements).toStrictEqual([]);
    });

    it('applies re-fetched state an older event triggered, without lowering the mark', async () => {
      const spaceId = await createSpace();
      const subscription = materializedSubscriptionBuilder()
        .with('status', 'active')
        .with('entitlements', null)
        .build();
      await materializeFromEvent({
        spaceId,
        subscription: subscription,
        eventAt: newerStamp,
      });

      await materializeAuthoritative({
        spaceId,
        subscriptions: [{ ...subscription, status: 'canceled' }],
        triggerEventAt: olderStamp,
      });

      const [persisted] = await getSubscriptions();
      expect(persisted).toMatchObject({
        status: 'canceled',
        lastEventAt: newerStamp,
      });
    });

    // What a slow re-fetch looks like from inside the transaction: the caller
    // read the mark, prepared its state, and by the time it got the lock a
    // concurrent delivery had already written something newer.
    it('abandons a write whose observed mark moved while it was prepared', async () => {
      const spaceId = await createSpace();
      const canceled = materializedSubscriptionBuilder()
        .with('status', 'canceled')
        .with('entitlements', null)
        .build();
      await materializeFromEvent({
        spaceId,
        subscription: canceled,
        eventAt: newerStamp,
      });

      const outcome = await materializeAuthoritative({
        spaceId,
        subscriptions: [{ ...canceled, status: 'active' }],
        triggerEventAt: new Date(newerStamp.getTime() + 20_000),
        // Read before the concurrent write above landed.
        observedEventAt: olderStamp,
      });

      expect(outcome).toBe(false);
      const [persisted] = await getSubscriptions();
      expect(persisted).toMatchObject({
        status: 'canceled',
        lastEventAt: newerStamp,
      });
    });
  });

  describe('getEntitlements', () => {
    it('returns the resolved entitlements for a member', async () => {
      const spaceId = await createSpace();
      const userId = await addMember(spaceId, 'ACTIVE');

      const result = await service.getEntitlements({
        spaceId,
        authPayload: authPayloadFor(userId),
      });

      expect(result.plan).toBeNull();
      expect(result.entitlements).toHaveLength(FEATURE_FIXTURES.length);
      expect(seatsOf(result)).toMatchObject({
        quota: FREE_SAFE_SEATS,
        used: 0,
        overLimit: false,
      });
    });

    it('rejects a non-member', async () => {
      const spaceId = await createSpace();
      const outsiderUserId = await dataSource
        .getRepository(User)
        .insert({ status: 'ACTIVE' })
        .then((inserted) => inserted.generatedMaps[0].id as number);

      await expect(
        service.getEntitlements({
          spaceId,
          authPayload: authPayloadFor(outsiderUserId),
        }),
      ).rejects.toThrow('User is not a member of this workspace');
    });
  });
});
