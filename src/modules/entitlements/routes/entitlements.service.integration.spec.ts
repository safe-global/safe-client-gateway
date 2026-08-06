// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { ConfigService } from '@nestjs/config';
import { DataSource, type EntityManager } from 'typeorm';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import configuration from '@/config/entities/__tests__/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import type { ILoggingService } from '@/logging/logging.interface';
import { Feature } from '@/modules/entitlements/datasources/entities/feature.entity.db';
import { SpaceFeatureUsage } from '@/modules/entitlements/datasources/entities/space-feature-usage.entity.db';
import { SpaceSeatSelection } from '@/modules/entitlements/datasources/entities/space-seat-selection.entity.db';
import { SpaceSubscription } from '@/modules/entitlements/datasources/entities/space-subscription.entity.db';
import { SubscriptionEntitlement } from '@/modules/entitlements/datasources/entities/subscription-entitlement.entity.db';
import type {
  FeatureKey,
  FeatureType,
} from '@/modules/entitlements/domain/entities/feature.entity';
import {
  FEATURE_DEFINITIONS,
  FeatureTypes,
} from '@/modules/entitlements/domain/entities/feature.entity';
import type { MaterializedSubscription } from '@/modules/entitlements/domain/entities/materialized-subscription.entity';
import { ENFORCEMENT_LAUNCH_DATE } from '@/modules/entitlements/domain/entitlements.constants';
import { QuotaExceededError } from '@/modules/entitlements/domain/errors/quota-exceeded.error';
import { FeaturesRepository } from '@/modules/entitlements/domain/features.repository';
import {
  isStockMeteredFeature,
  STOCK_METERED_FEATURES,
} from '@/modules/entitlements/domain/metered-features.registry';
import { SpaceFeatureUsageRepository } from '@/modules/entitlements/domain/space-feature-usage.repository';
import { SpaceSeatSelectionRepository } from '@/modules/entitlements/domain/space-seat-selection.repository';
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
import { activeOrPendingMemberWhere } from '@/modules/users/domain/members/utils/members.utils';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';

const mockLoggingService = {
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

// The suite owns its catalog: the production Free-tier values are still
// pending product sign-off, so no seed migration ships them and these tests
// must not depend on one. The fixtures below cover every resolution branch
// the repository implements — binary, value, stock-metered (usage is a live
// COUNT over an existing table) and event-metered (usage is a period-keyed
// `space_feature_usage` counter). Keys come from the real `FeatureKey` enum
// because the repository dispatches stock counting by key.
const FREE_SAFE_SEATS = 2;
const FREE_MEMBERS = 5;
const FREE_SPONSORED_TXS = 10;
const SPONSORED_PERIOD_DAYS = 30;

type FeatureFixture = {
  key: FeatureKey;
  type: FeatureType;
  freeEnabled: boolean;
  freeQuota: number | null;
  freeValue: string | null;
  freePeriod: number | null;
};

const FEATURE_FIXTURES: Array<FeatureFixture> = [
  {
    key: 'security_hub',
    type: 'binary',
    freeEnabled: false,
    freeQuota: null,
    freeValue: null,
    freePeriod: null,
  },
  // A second binary, never purchased by any test, so the "unpurchased feature
  // falls back to the Free default" branch stays covered.
  {
    key: 'pay_from_safe',
    type: 'binary',
    freeEnabled: false,
    freeQuota: null,
    freeValue: null,
    freePeriod: null,
  },
  {
    key: 'safe_seats',
    type: 'metered',
    freeEnabled: true,
    freeQuota: FREE_SAFE_SEATS,
    freeValue: null,
    freePeriod: null,
  },
  {
    key: 'members',
    type: 'metered',
    freeEnabled: true,
    freeQuota: FREE_MEMBERS,
    freeValue: null,
    freePeriod: null,
  },
  // Free-disabled by default so the "disabled admits no usage" path is
  // covered; the `consume` tests enable it explicitly.
  {
    key: 'sponsored_transactions',
    type: 'metered',
    freeEnabled: false,
    freeQuota: 0,
    freeValue: null,
    freePeriod: SPONSORED_PERIOD_DAYS,
  },
  {
    key: 'swap_fee_tier',
    type: 'value',
    freeEnabled: true,
    freeQuota: null,
    freeValue: 'free',
    freePeriod: null,
  },
];

const DAY_IN_MS = 24 * 60 * 60 * 1_000;
// Space creation dates on either side of the enforcement launch, so the
// grandfathering assertions stay valid whatever the constant is set to.
const PRE_LAUNCH = new Date(ENFORCEMENT_LAUNCH_DATE.getTime() - DAY_IN_MS);
const POST_LAUNCH = new Date(ENFORCEMENT_LAUNCH_DATE.getTime() + DAY_IN_MS);

describe('EntitlementsService', () => {
  let postgresDatabaseService: PostgresDatabaseService;
  // The service composes the per-table repositories; exercised here against
  // the real database so queries and derivation rules are covered end to end.
  let service: EntitlementsService;

  const testDatabaseName = faker.string.alpha({ length: 10, casing: 'lower' });
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
      SpaceSeatSelection,
    ],
  });

  // Stubs for the collaborating modules' repositories: thin adapters over the
  // same test database, so the queries they stand in for still run for real.
  // Their production implementations are covered by their own specs.
  const spacesRepositoryStub = {
    findOne: async (args: Parameters<ISpacesRepository['findOne']>[0]) =>
      await dataSource.getRepository(Space).findOne(args),
  } as unknown as ISpacesRepository;

  const spaceSafesRepositoryStub = {
    countBySpaceId: async (spaceId: number, entityManager?: EntityManager) =>
      await (entityManager ?? dataSource.manager).count(SpaceSafe, {
        where: { space: { id: spaceId } },
      }),
    getIdsBySpaceIdOldestFirst: async (
      spaceId: number,
      entityManager?: EntityManager,
    ) => {
      const safes = await (entityManager ?? dataSource.manager).find(
        SpaceSafe,
        {
          select: { id: true },
          where: { space: { id: spaceId } },
          order: { createdAt: 'ASC', id: 'ASC' },
        },
      );
      return safes.map((safe) => safe.id);
    },
  } as unknown as ISpaceSafesRepository;

  const membersRepositoryStub = {
    countActiveOrPendingBySpaceId: async (
      spaceId: number,
      entityManager?: EntityManager,
    ) =>
      await (entityManager ?? dataSource.manager).count(Member, {
        where: activeOrPendingMemberWhere<Member>(() => ({
          space: { id: spaceId },
        })),
      }),
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

    service = new EntitlementsService(
      new FeaturesRepository(postgresDatabaseService),
      new SubscriptionsRepository(postgresDatabaseService),
      new SubscriptionEntitlementsRepository(postgresDatabaseService),
      new SpaceFeatureUsageRepository(postgresDatabaseService),
      new SpaceSeatSelectionRepository(postgresDatabaseService),
      spacesRepositoryStub,
      spaceSafesRepositoryStub,
      membersRepositoryStub,
      postgresDatabaseService,
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
      .getRepository(SpaceSeatSelection)
      .createQueryBuilder()
      .delete()
      .execute();
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

  async function createSpace(args?: { createdAt?: Date }): Promise<number> {
    const inserted = await dataSource.getRepository(Space).insert({
      name: faker.company.name(),
      status: 'ACTIVE',
    });
    const spaceId = inserted.generatedMaps[0].id as number;
    if (args?.createdAt) {
      await dataSource.query(
        `UPDATE spaces SET created_at = $1 WHERE id = $2`,
        [args.createdAt, spaceId],
      );
    }
    return spaceId;
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

  async function getSafeIdsOldestFirst(
    spaceId: number,
  ): Promise<Array<number>> {
    const safes = await dataSource.getRepository(SpaceSafe).find({
      select: { id: true },
      where: { space: { id: spaceId } },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return safes.map((safe) => safe.id);
  }

  async function addMember(
    spaceId: number,
    status: 'ACTIVE' | 'INVITED' | 'DECLINED',
    inviteExpiresAt?: Date,
  ): Promise<void> {
    const user = await dataSource.getRepository(User).insert({
      status: 'ACTIVE',
    });
    await dataSource.getRepository(Member).insert({
      user: { id: user.generatedMaps[0].id as number },
      space: { id: spaceId },
      name: faker.person.firstName(),
      role: 'MEMBER',
      status,
      inviteExpiresAt:
        status === 'INVITED' ? (inviteExpiresAt ?? faker.date.future()) : null,
    });
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

  describe('feature catalog fixtures', () => {
    // The DB-vs-`FeatureKeys` drift guard belongs with the seed migration,
    // which ships once product signs the real values off. What matters here is
    // that the fixtures stay a faithful, exhaustive sample of the catalog.
    it('declares types matching FEATURE_DEFINITIONS and covers every feature type', async () => {
      const features = await dataSource.getRepository(Feature).find();

      expect(features).toHaveLength(FEATURE_FIXTURES.length);
      for (const feature of features) {
        expect(feature.type).toBe(FEATURE_DEFINITIONS[feature.key]);
      }
      expect(new Set(features.map((feature) => feature.type))).toStrictEqual(
        new Set(FeatureTypes),
      );
    });

    it('covers both metered flavors: stock-counted and event-counted', () => {
      const metered = FEATURE_FIXTURES.filter(
        (fixture) => fixture.type === 'metered',
      );

      expect(
        metered.filter((fixture) => isStockMeteredFeature(fixture.key)),
      ).not.toHaveLength(0);
      expect(
        metered.filter((fixture) => !isStockMeteredFeature(fixture.key)),
      ).not.toHaveLength(0);
    });
  });

  describe('resolveEntitlements', () => {
    it('resolves the Free branch from catalog defaults when no subscription exists', async () => {
      const spaceId = await createSpace();
      await addSafes(spaceId, 2);
      await addMember(spaceId, 'ACTIVE');

      const result = await service.resolveEntitlements(spaceId);

      expect(result.plan).toBeNull();
      expect(result.overSeatSafeIds).toStrictEqual([]);
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
        type: 'metered',
        enabled: true,
        quota: FREE_SAFE_SEATS,
        used: 2,
        resetsAt: null,
        grandfathered: false,
      });
      expect(byFeature.get('members')).toMatchObject({
        quota: FREE_MEMBERS,
        used: 1,
      });
      expect(byFeature.get('security_hub')).toStrictEqual({
        feature: 'security_hub',
        type: 'binary',
        enabled: false,
      });
      expect(byFeature.get('swap_fee_tier')).toStrictEqual({
        feature: 'swap_fee_tier',
        type: 'value',
        enabled: true,
        value: 'free',
      });
      // Event-metered on the Free tier: disabled, so no usage is admitted.
      expect(byFeature.get('sponsored_transactions')).toMatchObject({
        type: 'metered',
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
      await service.materialize({ spaceId, subscriptions: [subscription] });

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
      // Not purchased → Free defaults, for both a metered and a binary one.
      expect(byFeature.get('members')).toMatchObject({ quota: FREE_MEMBERS });
      expect(byFeature.get('pay_from_safe')).toMatchObject({ enabled: false });
    });

    it('derives grandfathering for pre-launch, never-subscribed, over-quota spaces', async () => {
      const spaceId = await createSpace({ createdAt: PRE_LAUNCH });
      await addSafes(spaceId, FREE_SAFE_SEATS + 1);

      const result = await service.resolveEntitlements(spaceId);

      const seats = result.entitlements.find(
        (entitlement) => entitlement.feature === 'safe_seats',
      );
      // Quota is never inflated; used > quota is legal.
      expect(seats).toMatchObject({
        quota: FREE_SAFE_SEATS,
        used: FREE_SAFE_SEATS + 1,
        grandfathered: true,
      });
      // Grandfathered spaces never degrade.
      expect(result.overSeatSafeIds).toStrictEqual([]);
    });

    it('does not grandfather spaces created after the enforcement launch date', async () => {
      const spaceId = await createSpace({ createdAt: POST_LAUNCH });
      await addSafes(spaceId, FREE_SAFE_SEATS + 2);

      const result = await service.resolveEntitlements(spaceId);

      const seats = result.entitlements.find(
        (entitlement) => entitlement.feature === 'safe_seats',
      );
      expect(seats).toMatchObject({ grandfathered: false });
      expect(result.overSeatSafeIds).toHaveLength(2);
    });

    it('purchasing permanently ends grandfathering, even after cancellation', async () => {
      const spaceId = await createSpace({ createdAt: PRE_LAUNCH });
      await addSafes(spaceId, FREE_SAFE_SEATS + 1);

      // Buy a plan below usage, then cancel it.
      await service.materialize({
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
      await service.materialize({
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

      // Back on Free rules, but the protection is gone.
      const seats = result.entitlements.find(
        (entitlement) => entitlement.feature === 'safe_seats',
      );
      expect(seats).toMatchObject({
        quota: FREE_SAFE_SEATS,
        grandfathered: false,
      });
      expect(result.overSeatSafeIds).toHaveLength(1);
    });

    it('ends grandfathering immediately on purchase, surfacing over-seat Safes in the same read', async () => {
      const spaceId = await createSpace({ createdAt: PRE_LAUNCH });
      await addSafes(spaceId, FREE_SAFE_SEATS + 1);

      // Grandfathered while it stays on Free.
      const beforePurchase = await service.resolveEntitlements(spaceId);
      expect(
        beforePurchase.entitlements.find(
          (entitlement) => entitlement.feature === 'safe_seats',
        ),
      ).toMatchObject({ grandfathered: true });
      expect(beforePurchase.overSeatSafeIds).toStrictEqual([]);

      // Buying a plan below current usage: "you get exactly what you pay for".
      await service.materialize({
        spaceId,
        subscriptions: [
          materializedSubscription({
            entitlements: [
              {
                featureKey: 'safe_seats',
                enabled: true,
                quota: FREE_SAFE_SEATS,
                value: null,
              },
            ],
          }),
        ],
      });

      // Both flags flip in the very same read: no intervening cancellation,
      // no stored state to migrate.
      const afterPurchase = await service.resolveEntitlements(spaceId);
      expect(
        afterPurchase.entitlements.find(
          (entitlement) => entitlement.feature === 'safe_seats',
        ),
      ).toMatchObject({
        quota: FREE_SAFE_SEATS,
        used: FREE_SAFE_SEATS + 1,
        grandfathered: false,
      });
      expect(afterPurchase.overSeatSafeIds).toHaveLength(1);
    });

    it('computes over-seat Safes oldest-first by default', async () => {
      const spaceId = await createSpace({ createdAt: POST_LAUNCH });
      await service.materialize({
        spaceId,
        subscriptions: [
          materializedSubscription({
            entitlements: [
              {
                featureKey: 'safe_seats',
                enabled: true,
                quota: 2,
                value: null,
              },
            ],
          }),
        ],
      });
      await addSafes(spaceId, 4);
      const safeIds = await getSafeIdsOldestFirst(spaceId);

      const result = await service.resolveEntitlements(spaceId);

      // The two oldest keep the seats; the two newest go over-seat.
      expect(result.overSeatSafeIds).toStrictEqual(safeIds.slice(2));
    });

    it('honors the stored seat selection and tops it up oldest-first', async () => {
      const spaceId = await createSpace({ createdAt: POST_LAUNCH });
      await service.materialize({
        spaceId,
        subscriptions: [
          materializedSubscription({
            entitlements: [
              {
                featureKey: 'safe_seats',
                enabled: true,
                quota: 2,
                value: null,
              },
            ],
          }),
        ],
      });
      await addSafes(spaceId, 4);
      const safeIds = await getSafeIdsOldestFirst(spaceId);

      // Admin covers only the NEWEST Safe: 1 selected + top-up with the oldest.
      await service.replaceSeatSelection({
        spaceId,
        spaceSafeIds: [safeIds[3]],
      });

      const result = await service.resolveEntitlements(spaceId);
      expect(result.overSeatSafeIds).toStrictEqual([safeIds[1], safeIds[2]]);

      // Clearing the selection restores the default (oldest-first) coverage.
      await service.replaceSeatSelection({ spaceId, spaceSafeIds: [] });
      const restored = await service.resolveEntitlements(spaceId);
      expect(restored.overSeatSafeIds).toStrictEqual(safeIds.slice(2));
    });

    it('drops the selection of a removed Safe via FK cascade', async () => {
      const spaceId = await createSpace({ createdAt: POST_LAUNCH });
      await service.materialize({
        spaceId,
        subscriptions: [
          materializedSubscription({
            entitlements: [
              {
                featureKey: 'safe_seats',
                enabled: true,
                quota: 1,
                value: null,
              },
            ],
          }),
        ],
      });
      await addSafes(spaceId, 3);
      const safeIds = await getSafeIdsOldestFirst(spaceId);
      await service.replaceSeatSelection({
        spaceId,
        spaceSafeIds: [safeIds[2]],
      });

      await dataSource.getRepository(SpaceSafe).delete(safeIds[2]);

      const selections = await dataSource
        .getRepository(SpaceSeatSelection)
        .find();
      expect(selections).toHaveLength(0);
      const result = await service.resolveEntitlements(spaceId);
      expect(result.overSeatSafeIds).toStrictEqual([safeIds[1]]);
    });
  });

  describe('materialize', () => {
    it('is idempotent: reprocessing the same state yields the same rows', async () => {
      const spaceId = await createSpace();
      const subscription = materializedSubscription({
        entitlements: [
          { featureKey: 'safe_seats', enabled: true, quota: 10, value: null },
          {
            featureKey: 'security_hub',
            enabled: true,
            quota: null,
            value: null,
          },
        ],
      });

      await service.materialize({ spaceId, subscriptions: [subscription] });
      await service.materialize({ spaceId, subscriptions: [subscription] });

      expect(await dataSource.getRepository(SpaceSubscription).count()).toBe(1);
      expect(
        await dataSource.getRepository(SubscriptionEntitlement).count(),
      ).toBe(2);
    });

    it('replaces the active slot on upgrade, keeping the old subscription as history', async () => {
      const spaceId = await createSpace();
      await service.materialize({
        spaceId,
        subscriptions: [
          materializedSubscription({
            upstreamSubscriptionId: 'sub_old',
            planId: 'starter',
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

      // Upgrade: the old subscription cancels, a new one becomes active.
      await service.materialize({
        spaceId,
        subscriptions: [
          materializedSubscription({
            upstreamSubscriptionId: 'sub_old',
            planId: 'starter',
            status: 'canceled',
            entitlements: null,
          }),
          materializedSubscription({
            upstreamSubscriptionId: 'sub_new',
            planId: 'business',
            entitlements: [
              {
                featureKey: 'safe_seats',
                enabled: true,
                quota: 20,
                value: null,
              },
            ],
          }),
        ],
      });

      const subscriptions = await dataSource
        .getRepository(SpaceSubscription)
        .find();
      expect(subscriptions).toHaveLength(2);

      const result = await service.resolveEntitlements(spaceId);
      expect(result.plan?.id).toBe('business');
      const seats = result.entitlements.find(
        (entitlement) => entitlement.feature === 'safe_seats',
      );
      expect(seats).toMatchObject({ quota: 20 });
    });
  });

  describe('checkQuotaOrFail', () => {
    // The guard is only meaningful inside the caller's transaction, so every
    // test drives it the way real callers must.
    async function checkQuota(args: {
      spaceId: number;
      featureKey: FeatureKey;
      increment: number;
    }): Promise<void> {
      await postgresDatabaseService.transaction(async (entityManager) => {
        await service.checkQuotaOrFail({ ...args, entityManager });
      });
    }

    it('throws a typed QuotaExceededError when the increment would exceed the quota', async () => {
      const spaceId = await createSpace();
      await addSafes(spaceId, FREE_SAFE_SEATS);

      await expect(
        checkQuota({ spaceId, featureKey: 'safe_seats', increment: 1 }),
      ).rejects.toThrow(QuotaExceededError);

      try {
        await checkQuota({ spaceId, featureKey: 'safe_seats', increment: 1 });
      } catch (err) {
        expect(err).toMatchObject({
          feature: 'safe_seats',
          quota: FREE_SAFE_SEATS,
          used: FREE_SAFE_SEATS,
          resetsAt: null,
        });
      }
    });

    it('rejects a batch that partially exceeds the quota', async () => {
      const spaceId = await createSpace();
      await addSafes(spaceId, FREE_SAFE_SEATS - 1);

      await expect(
        checkQuota({ spaceId, featureKey: 'safe_seats', increment: 2 }),
      ).rejects.toThrow(QuotaExceededError);
      await expect(
        checkQuota({ spaceId, featureKey: 'safe_seats', increment: 1 }),
      ).resolves.toBeUndefined();
    });

    it('never throws for an unlimited quota', async () => {
      const spaceId = await createSpace();
      await service.materialize({
        spaceId,
        subscriptions: [
          materializedSubscription({
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
      await addSafes(spaceId, FREE_SAFE_SEATS + 5);

      await expect(
        checkQuota({ spaceId, featureKey: 'safe_seats', increment: 100 }),
      ).resolves.toBeUndefined();
    });

    it('counts ACTIVE and non-expired INVITED members, ignoring DECLINED and expired invites', async () => {
      const spaceId = await createSpace();
      for (let i = 0; i < FREE_MEMBERS - 1; i++) {
        await addMember(spaceId, 'ACTIVE');
      }
      await addMember(spaceId, 'DECLINED');
      await addMember(spaceId, 'INVITED', faker.date.past());

      // 4 seats held → 1 left.
      await expect(
        checkQuota({ spaceId, featureKey: 'members', increment: 1 }),
      ).resolves.toBeUndefined();

      await addMember(spaceId, 'INVITED');
      // 5 seats held → full.
      await expect(
        checkQuota({ spaceId, featureKey: 'members', increment: 1 }),
      ).rejects.toThrow(QuotaExceededError);
    });

    // Enforcement dispatches through STOCK_METERED_SOURCES, so every
    // registered feature is guarded by the same primitive: adding one is a
    // registry entry plus a catalog row, not a new code path.
    it.each(
      STOCK_METERED_FEATURES,
    )('enforces the %s quota through the shared registry', async (featureKey) => {
      const quota = featureKey === 'safe_seats' ? 1 : 0;
      const spaceId = await createSpace();
      await service.materialize({
        spaceId,
        subscriptions: [
          materializedSubscription({
            entitlements: [{ featureKey, enabled: true, quota, value: null }],
          }),
        ],
      });
      if (featureKey === 'safe_seats') {
        await addSafes(spaceId, 1);
      }

      await expect(
        checkQuota({ spaceId, featureKey, increment: 1 }),
      ).rejects.toThrow(QuotaExceededError);
    });
  });

  describe('consume', () => {
    // sponsored_transactions ships Free-disabled in the fixtures; per the RFC,
    // changing the Free tier is an UPDATE on the catalog row, which is exactly
    // what this helper exercises. The per-test fixture reset in `beforeEach`
    // undoes it, so no restore hook is needed.
    async function enableSponsoredFreeTier(): Promise<void> {
      await dataSource.query(
        `UPDATE features SET free_enabled = TRUE, free_quota = $1
         WHERE key = 'sponsored_transactions'`,
        [FREE_SPONSORED_TXS],
      );
    }

    it('increments the period-keyed counter and reflects it in resolveEntitlements', async () => {
      await enableSponsoredFreeTier();
      const spaceId = await createSpace();

      await expect(
        service.consume({
          spaceId,
          featureKey: 'sponsored_transactions',
          amount: 3,
        }),
      ).resolves.toStrictEqual({ used: 3, quota: FREE_SPONSORED_TXS });
      await expect(
        service.consume({ spaceId, featureKey: 'sponsored_transactions' }),
      ).resolves.toStrictEqual({ used: 4, quota: FREE_SPONSORED_TXS });

      const result = await service.resolveEntitlements(spaceId);
      const sponsored = result.entitlements.find(
        (entitlement) => entitlement.feature === 'sponsored_transactions',
      );
      // Free metered window anchored at the space's creation date.
      expect(sponsored).toMatchObject({ used: 4 });
      expect(sponsored?.resetsAt).toBeInstanceOf(Date);
    });

    it('throws a typed QuotaExceededError when consumption would exceed the quota', async () => {
      await enableSponsoredFreeTier();
      const spaceId = await createSpace();
      await service.consume({
        spaceId,
        featureKey: 'sponsored_transactions',
        amount: FREE_SPONSORED_TXS,
      });

      await expect(
        service.consume({ spaceId, featureKey: 'sponsored_transactions' }),
      ).rejects.toThrow(QuotaExceededError);

      // Nothing was consumed by the failed attempt.
      const result = await service.resolveEntitlements(spaceId);
      const sponsored = result.entitlements.find(
        (entitlement) => entitlement.feature === 'sponsored_transactions',
      );
      expect(sponsored).toMatchObject({ used: FREE_SPONSORED_TXS });
    });

    it('is atomic under concurrent consumption', async () => {
      await enableSponsoredFreeTier();
      const spaceId = await createSpace();

      const results = await Promise.allSettled(
        Array.from({ length: FREE_SPONSORED_TXS + 5 }, () =>
          service.consume({ spaceId, featureKey: 'sponsored_transactions' }),
        ),
      );

      const fulfilled = results.filter(
        (result) => result.status === 'fulfilled',
      );
      const rejected = results.filter((result) => result.status === 'rejected');
      expect(fulfilled).toHaveLength(FREE_SPONSORED_TXS);
      expect(rejected).toHaveLength(5);

      const usage = await dataSource.getRepository(SpaceFeatureUsage).find();
      expect(usage).toHaveLength(1);
      expect(usage[0].used).toBe(FREE_SPONSORED_TXS);
    });

    it('rejects consumption of a Free-disabled feature', async () => {
      const spaceId = await createSpace();

      await expect(
        service.consume({ spaceId, featureKey: 'sponsored_transactions' }),
      ).rejects.toThrow(QuotaExceededError);
    });

    it('rejects stock-type features', async () => {
      const spaceId = await createSpace();

      await expect(
        service.consume({ spaceId, featureKey: 'safe_seats' }),
      ).rejects.toThrow('counted live');
    });
  });
});
