// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { MockedObject } from 'vitest';
import configuration from '@/config/entities/__tests__/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import type { ILoggingService } from '@/logging/logging.interface';
import { Feature } from '@/modules/entitlements/datasources/entities/feature.entity.db';
import { SpaceFeatureUsage } from '@/modules/entitlements/datasources/entities/space-feature-usage.entity.db';
import { SpaceSeatSelection } from '@/modules/entitlements/datasources/entities/space-seat-selection.entity.db';
import { SpaceSubscription } from '@/modules/entitlements/datasources/entities/space-subscription.entity.db';
import { SubscriptionEntitlement } from '@/modules/entitlements/datasources/entities/subscription-entitlement.entity.db';
import { featureBuilder } from '@/modules/entitlements/domain/entities/__tests__/feature.builder';
import {
  materializedSubscriptionBuilder,
  parsedEntitlementBuilder,
} from '@/modules/entitlements/domain/entities/__tests__/materialized-subscription.builder';
import { FeatureTypes } from '@/modules/entitlements/domain/entities/feature.entity';
import { FeaturesRepository } from '@/modules/entitlements/domain/features.repository';
import { SubscriptionEntitlementsRepository } from '@/modules/entitlements/domain/subscription-entitlements.repository';
import { SubscriptionsRepository } from '@/modules/entitlements/domain/subscriptions.repository';
import { EntitlementsService } from '@/modules/entitlements/routes/entitlements.service';
import { SpaceSafe } from '@/modules/spaces/datasources/safes/entities/space-safes.entity.db';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';

const mockLoggingService = {
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

// The suite owns its catalog: the production Free-tier values are still
// pending product sign-off, so no seed migration ships them and these tests
// must not depend on one. The fixtures stay an exhaustive sample of the
// catalog's feature types, so the key → id mapping `materialize` builds is
// exercised for each of them. Only `key`/`type` are asserted on in this file;
// every other field is left at the builder's faker default.
const FEATURES: Array<Feature> = [
  featureBuilder().with('key', 'security_hub').with('type', 'binary').build(),
  featureBuilder().with('key', 'safe_seats').with('type', 'metered').build(),
  featureBuilder()
    .with('key', 'sponsored_transactions')
    .with('type', 'metered')
    .build(),
  featureBuilder().with('key', 'swap_fee_tier').with('type', 'value').build(),
];

describe('EntitlementsService', () => {
  let postgresDatabaseService: PostgresDatabaseService;
  // The service composes the per-table repositories; exercised here against
  // the real database so the queries and the transaction run for real.
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

  // Stub for the collaborating module's repository: a thin adapter over the
  // same test database, so the query it stands in for still runs for real.
  // Its production implementation is covered by its own spec.
  const spacesRepositoryStub = {
    findUuidById: async (id: Space['id']): Promise<Space['uuid']> => {
      const space = await dataSource
        .getRepository(Space)
        .findOne({ where: { id }, select: { uuid: true } });
      if (!space) throw new NotFoundException('Workspace not found.');
      return space.uuid;
    },
  } as unknown as ISpacesRepository;

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
      spacesRepositoryStub,
      postgresDatabaseService,
      mockLoggingService,
    );
  });

  beforeEach(async () => {
    await dataSource.getRepository(Feature).insert(FEATURES);
  });

  afterEach(async () => {
    // Dependency order: `features` last, as the entitlement rows reference it
    // with ON DELETE RESTRICT.
    for (const entity of [
      SubscriptionEntitlement,
      SpaceSubscription,
      Space,
      Feature,
    ]) {
      await dataSource
        .getRepository(entity)
        .createQueryBuilder()
        .delete()
        .execute();
    }
  });

  afterAll(async () => {
    await postgresDatabaseService.getDataSource().dropDatabase();
    await postgresDatabaseService.destroyDatabaseConnection();
  });

  async function createSpace(): Promise<number> {
    const inserted = await dataSource.getRepository(Space).insert({
      name: nameBuilder(),
      status: 'ACTIVE',
    });
    return inserted.generatedMaps[0].id as number;
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
        FEATURES.map((fixture) => [fixture.key, fixture.type]),
      );

      expect(features).toHaveLength(FEATURES.length);
      for (const feature of features) {
        expect(feature.type).toBe(typeByKey.get(feature.key));
      }
      expect(new Set(features.map((feature) => feature.type))).toStrictEqual(
        new Set(FeatureTypes),
      );
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

      await service.materialize({ spaceId, subscriptions: [subscription] });

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

      await service.materialize({ spaceId, subscriptions: [subscription] });

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

      await service.materialize({ spaceId, subscriptions: [subscription] });
      await service.materialize({ spaceId, subscriptions: [subscription] });

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
      await service.materialize({
        spaceId,
        subscriptions: [oldSubscription],
      });

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
      await service.materialize({
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
      await service.materialize({
        spaceId,
        subscriptions: [oldSubscription],
      });

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
      await service.materialize({
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

    it('rejects an unknown workspace', async () => {
      await expect(
        service.materialize({
          spaceId: faker.number.int({ min: 100_000, max: 1_000_000 }),
          subscriptions: [materializedSubscriptionBuilder().build()],
        }),
      ).rejects.toThrow('Workspace not found.');
    });

    it('rejects a batch with more than one subscription carrying a package', async () => {
      const spaceId = await createSpace();

      await expect(
        service.materialize({
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
});
