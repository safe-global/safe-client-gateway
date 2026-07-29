// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
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
import {
  FEATURE_DEFINITIONS,
  FeatureKeys,
} from '@/modules/entitlements/domain/entities/feature.entity';
import type { MaterializedSubscription } from '@/modules/entitlements/domain/entities/materialized-subscription.entity';
import { ENFORCEMENT_LAUNCH_DATE } from '@/modules/entitlements/domain/entitlements.constants';
import { EntitlementsRepository } from '@/modules/entitlements/domain/entitlements.repository';
import { QuotaExceededError } from '@/modules/entitlements/domain/errors/quota-exceeded.error';
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

// Seeded Free-tier defaults (see the seed-features migration).
const FREE_SAFE_SEATS = 10;
const FREE_MEMBERS = 5;

const DAY_IN_MS = 24 * 60 * 60 * 1_000;
// Space creation dates on either side of the enforcement launch, so the
// grandfathering assertions stay valid whatever the constant is set to.
const PRE_LAUNCH = new Date(ENFORCEMENT_LAUNCH_DATE.getTime() - DAY_IN_MS);
const POST_LAUNCH = new Date(ENFORCEMENT_LAUNCH_DATE.getTime() + DAY_IN_MS);

describe('EntitlementsRepository', () => {
  let postgresDatabaseService: PostgresDatabaseService;
  let target: EntitlementsRepository;

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

    target = new EntitlementsRepository(postgresDatabaseService);
  });

  afterEach(async () => {
    // Delete in dependency order (features are seeded, keep them).
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

  describe('seeded catalog', () => {
    it('matches the FeatureKeys enum and FEATURE_DEFINITIONS types (drift guard)', async () => {
      const features = await dataSource.getRepository(Feature).find();

      expect(new Set(features.map((feature) => feature.key))).toStrictEqual(
        new Set(FeatureKeys),
      );
      for (const feature of features) {
        expect(feature.type).toBe(FEATURE_DEFINITIONS[feature.key]);
      }
    });
  });

  describe('resolveEntitlements', () => {
    it('resolves the Free branch from catalog defaults when no subscription exists', async () => {
      const spaceId = await createSpace();
      await addSafes(spaceId, 2);
      await addMember(spaceId, 'ACTIVE');

      const result = await target.resolveEntitlements(spaceId);

      expect(result.plan).toBeNull();
      expect(result.overSeatSafeIds).toStrictEqual([]);
      expect(result.entitlements).toHaveLength(FeatureKeys.length);

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
      expect(byFeature.get('copilot_scans')).toStrictEqual({
        feature: 'copilot_scans',
        type: 'binary',
        enabled: false,
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
      await target.materialize({ spaceId, subscriptions: [subscription] });

      const result = await target.resolveEntitlements(spaceId);

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
      expect(byFeature.get('members')).toMatchObject({ quota: FREE_MEMBERS });
      expect(byFeature.get('pay_from_safe')).toMatchObject({ enabled: false });
    });

    it('derives grandfathering for pre-launch, never-subscribed, over-quota spaces', async () => {
      const spaceId = await createSpace({ createdAt: PRE_LAUNCH });
      await addSafes(spaceId, FREE_SAFE_SEATS + 1);

      const result = await target.resolveEntitlements(spaceId);

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

      const result = await target.resolveEntitlements(spaceId);

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
      await target.materialize({
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
      await target.materialize({
        spaceId,
        subscriptions: [
          materializedSubscription({
            upstreamSubscriptionId: 'sub_1',
            status: 'canceled',
            entitlements: null,
          }),
        ],
      });

      const result = await target.resolveEntitlements(spaceId);

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

    it('computes over-seat Safes oldest-first by default', async () => {
      const spaceId = await createSpace({ createdAt: POST_LAUNCH });
      await target.materialize({
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

      const result = await target.resolveEntitlements(spaceId);

      // The two oldest keep the seats; the two newest go over-seat.
      expect(result.overSeatSafeIds).toStrictEqual(safeIds.slice(2));
    });

    it('honors the stored seat selection and tops it up oldest-first', async () => {
      const spaceId = await createSpace({ createdAt: POST_LAUNCH });
      await target.materialize({
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
      await target.replaceSeatSelection({
        spaceId,
        spaceSafeIds: [safeIds[3]],
      });

      const result = await target.resolveEntitlements(spaceId);
      expect(result.overSeatSafeIds).toStrictEqual([safeIds[1], safeIds[2]]);

      // Clearing the selection restores the default (oldest-first) coverage.
      await target.replaceSeatSelection({ spaceId, spaceSafeIds: [] });
      const restored = await target.resolveEntitlements(spaceId);
      expect(restored.overSeatSafeIds).toStrictEqual(safeIds.slice(2));
    });

    it('drops the selection of a removed Safe via FK cascade', async () => {
      const spaceId = await createSpace({ createdAt: POST_LAUNCH });
      await target.materialize({
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
      await target.replaceSeatSelection({
        spaceId,
        spaceSafeIds: [safeIds[2]],
      });

      await dataSource.getRepository(SpaceSafe).delete(safeIds[2]);

      const selections = await dataSource
        .getRepository(SpaceSeatSelection)
        .find();
      expect(selections).toHaveLength(0);
      const result = await target.resolveEntitlements(spaceId);
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

      await target.materialize({ spaceId, subscriptions: [subscription] });
      await target.materialize({ spaceId, subscriptions: [subscription] });

      expect(await dataSource.getRepository(SpaceSubscription).count()).toBe(1);
      expect(
        await dataSource.getRepository(SubscriptionEntitlement).count(),
      ).toBe(2);
    });

    it('replaces the active slot on upgrade, keeping the old subscription as history', async () => {
      const spaceId = await createSpace();
      await target.materialize({
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
      await target.materialize({
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

      const result = await target.resolveEntitlements(spaceId);
      expect(result.plan?.id).toBe('business');
      const seats = result.entitlements.find(
        (entitlement) => entitlement.feature === 'safe_seats',
      );
      expect(seats).toMatchObject({ quota: 20 });
    });
  });

  describe('checkQuotaOrFail', () => {
    it('throws a typed QuotaExceededError when the increment would exceed the quota', async () => {
      const spaceId = await createSpace();
      await addSafes(spaceId, FREE_SAFE_SEATS);

      await expect(
        target.checkQuotaOrFail({
          spaceId,
          featureKey: 'safe_seats',
          increment: 1,
        }),
      ).rejects.toThrow(QuotaExceededError);

      try {
        await target.checkQuotaOrFail({
          spaceId,
          featureKey: 'safe_seats',
          increment: 1,
        });
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
        target.checkQuotaOrFail({
          spaceId,
          featureKey: 'safe_seats',
          increment: 2,
        }),
      ).rejects.toThrow(QuotaExceededError);
      await expect(
        target.checkQuotaOrFail({
          spaceId,
          featureKey: 'safe_seats',
          increment: 1,
        }),
      ).resolves.toBeUndefined();
    });

    it('never throws for an unlimited quota', async () => {
      const spaceId = await createSpace();
      await target.materialize({
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
        target.checkQuotaOrFail({
          spaceId,
          featureKey: 'safe_seats',
          increment: 100,
        }),
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
        target.checkQuotaOrFail({
          spaceId,
          featureKey: 'members',
          increment: 1,
        }),
      ).resolves.toBeUndefined();

      await addMember(spaceId, 'INVITED');
      // 5 seats held → full.
      await expect(
        target.checkQuotaOrFail({
          spaceId,
          featureKey: 'members',
          increment: 1,
        }),
      ).rejects.toThrow(QuotaExceededError);
    });
  });

  describe('consume', () => {
    // sponsored_transactions is Free-disabled by default in the catalog;
    // per the RFC, changing the Free tier is an UPDATE on the catalog row,
    // which is exactly what these tests exercise.
    const FREE_SPONSORED_TXS = 10;

    async function enableSponsoredFreeTier(): Promise<void> {
      await dataSource.query(
        `UPDATE features SET free_enabled = TRUE, free_quota = $1
         WHERE key = 'sponsored_transactions'`,
        [FREE_SPONSORED_TXS],
      );
    }

    afterEach(async () => {
      await dataSource.query(
        `UPDATE features SET free_enabled = FALSE, free_quota = 0
         WHERE key = 'sponsored_transactions'`,
      );
    });

    it('increments the period-keyed counter and reflects it in resolveEntitlements', async () => {
      await enableSponsoredFreeTier();
      const spaceId = await createSpace();

      await expect(
        target.consume({
          spaceId,
          featureKey: 'sponsored_transactions',
          amount: 3,
        }),
      ).resolves.toStrictEqual({ used: 3, quota: FREE_SPONSORED_TXS });
      await expect(
        target.consume({ spaceId, featureKey: 'sponsored_transactions' }),
      ).resolves.toStrictEqual({ used: 4, quota: FREE_SPONSORED_TXS });

      const result = await target.resolveEntitlements(spaceId);
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
      await target.consume({
        spaceId,
        featureKey: 'sponsored_transactions',
        amount: FREE_SPONSORED_TXS,
      });

      await expect(
        target.consume({ spaceId, featureKey: 'sponsored_transactions' }),
      ).rejects.toThrow(QuotaExceededError);

      // Nothing was consumed by the failed attempt.
      const result = await target.resolveEntitlements(spaceId);
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
          target.consume({ spaceId, featureKey: 'sponsored_transactions' }),
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
        target.consume({ spaceId, featureKey: 'sponsored_transactions' }),
      ).rejects.toThrow(QuotaExceededError);
    });

    it('rejects stock-type features', async () => {
      const spaceId = await createSpace();

      await expect(
        target.consume({ spaceId, featureKey: 'safe_seats' }),
      ).rejects.toThrow('counted live');
    });
  });
});
