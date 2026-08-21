// SPDX-License-Identifier: FSL-1.1-MIT

import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type postgres from 'postgres';
import request from 'supertest';
import { In } from 'typeorm';
import type { MockedObject } from 'vitest';
import { TestDbFactory } from '@/__tests__/db.factory';
import {
  initTestApplication,
  TestAppProvider,
} from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { subscriptionPlanBuilder } from '@/datasources/billing-api/entities/__tests__/plan.builder';
import { subscriptionBuilder } from '@/datasources/billing-api/entities/__tests__/subscription.builder';
import type { Subscription } from '@/datasources/billing-api/entities/subscription.entity';
import { stripDashes } from '@/datasources/billing-api/upstream-customer-id.util';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import {
  type INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import {
  webhookEventBuilder,
  webhookEventCustomerBuilder,
} from '@/modules/billing/domain/entities/__tests__/webhook-event.builder';
import type { WebhookEvent } from '@/modules/billing/domain/entities/webhook-event.entity';
import { BillingWebhookAuthGuard } from '@/modules/billing/routes/guards/billing-webhook-auth.guard';
import { Feature } from '@/modules/entitlements/datasources/entities/feature.entity.db';
import { SpaceSubscription } from '@/modules/entitlements/datasources/entities/space-subscription.entity.db';
import { featureBuilder } from '@/modules/entitlements/domain/entities/__tests__/feature.builder';
import { FeatureType } from '@/modules/entitlements/domain/entities/feature.entity';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/test.notification.repository.module';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { rawify } from '@/validation/entities/raw.entity';

const WEBHOOK_PATH = '/v1/billing/webhooks';
// Epoch seconds, as the billing service sends them; asserted below, so they
// stay literal rather than faker-random.
const PERIOD_START = 1_700_000_000;
const PERIOD_END = 1_702_592_000;
// The keys this suite seeds into the `features` catalog with its own values.
const FEATURE_KEYS = ['safe_seats', 'security_hub'] as const;
// Event stamps, epoch seconds: the deletion happens after the update it is
// delivered before.
const UPDATED_AT = 1_786_460_184;
const DELETED_AT = UPDATED_AT + 10;

describe('Billing webhook → entitlements materialization', () => {
  let app: INestApplication<Server>;
  let networkService: MockedObject<INetworkService>;
  let postgresDatabaseService: PostgresDatabaseService;
  let billingBaseUri: string;
  const seededSpaceIds: Array<number> = [];

  // Its own database, like the repo's repository specs, because `features` is a
  // global table this suite seeds with its own values. Not faker: a fixed
  // FAKER_SEED would hand every spec file the same name.
  const testDatabaseName = `test_${randomUUID().replaceAll('-', '')}`;
  const testDbFactory = new TestDbFactory();
  let testDatabase: postgres.Sql;

  beforeAll(async () => {
    vi.resetAllMocks();

    testDatabase = await testDbFactory.createTestDatabase(testDatabaseName);

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      db: {
        ...defaultConfiguration.db,
        connection: {
          ...defaultConfiguration.db.connection,
          postgres: {
            ...defaultConfiguration.db.connection.postgres,
            database: testDatabaseName,
          },
        },
      },
      features: {
        ...defaultConfiguration.features,
        auth: true,
        users: true,
        billingService: true,
      },
      billing: {
        ...defaultConfiguration.billing,
        webhook: {
          ...defaultConfiguration.billing.webhook,
          publicKey: 'dummy-public-key',
        },
      },
    });

    const moduleFixture = await createTestModule({
      config: testConfiguration,
      overridePostgresV2: false,
      // Webhook origin authentication is covered by
      // billing-webhook-auth.guard.integration.spec.ts; this suite is about
      // what the authenticated event writes.
      guards: [
        {
          originalGuard: BillingWebhookAuthGuard,
          testGuard: { canActivate: (): true => true },
        },
      ],
      modules: [
        {
          originalModule: NotificationsRepositoryV2Module,
          testModule: TestNotificationsRepositoryV2Module,
        },
      ],
    });

    networkService = moduleFixture.get(NetworkService);
    postgresDatabaseService = moduleFixture.get(PostgresDatabaseService);
    billingBaseUri = moduleFixture
      .get<IConfigurationService>(IConfigurationService)
      .getOrThrow('billing.baseUri');

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);

    // Booting the app ran the migrations, so the catalog already holds the
    // shipped `safe_seats` row; drop it to seed this suite's own values.
    const featureRepo = await postgresDatabaseService.getRepository(Feature);
    await featureRepo.delete({ key: In(FEATURE_KEYS) });
    await featureRepo.insert([
      featureBuilder()
        .with('key', 'safe_seats')
        .with('type', FeatureType.Metered)
        .build(),
      featureBuilder()
        .with('key', 'security_hub')
        .with('type', FeatureType.Binary)
        .build(),
    ]);
  });

  afterEach(async () => {
    networkService.get.mockReset();
    if (seededSpaceIds.length === 0) return;
    // Deleting the spaces cascades through subscriptions and their
    // entitlements, so nothing this suite wrote outlives the test.
    const spaceRepo = await postgresDatabaseService.getRepository(Space);
    await spaceRepo.delete(seededSpaceIds);
    seededSpaceIds.length = 0;
  });

  afterAll(async () => {
    await app?.close();
    await testDbFactory.destroyTestDatabase(testDatabase);
  });

  async function seedSpace(): Promise<{ spaceId: number; spaceUuid: string }> {
    const spaceRepo = await postgresDatabaseService.getRepository(Space);
    const insert = await spaceRepo.insert({
      name: nameBuilder(),
      status: 'ACTIVE',
    });
    const spaceId = insert.identifiers[0].id as number;
    seededSpaceIds.push(spaceId);
    // uuid is filled by the DB default (gen_random_uuid()), so read it back.
    const space = await spaceRepo.findOneByOrFail({ id: spaceId });
    return { spaceId, spaceUuid: space.uuid };
  }

  function mockUpstreamSubscriptions(
    spaceUuid: string,
    subscriptions: Array<Subscription>,
  ): void {
    const url = `${billingBaseUri}/api/v1/customers/${stripDashes(spaceUuid)}/subscriptions`;
    networkService.get.mockImplementation(({ url: requested }) =>
      requested === url
        ? Promise.resolve({ data: rawify({ subscriptions }), status: 200 })
        : Promise.reject(new Error(`Could not match ${requested}`)),
    );
  }

  function webhookEventFor(
    spaceUuid: string,
    args: {
      type: string;
      subscriptionId: string;
      created?: number;
      data?: Partial<NonNullable<WebhookEvent['data']>>;
    },
  ): WebhookEvent {
    let builder = webhookEventBuilder().with('type', args.type);
    if (args.created !== undefined) {
      builder = builder.with('created', args.created);
    }
    const event = builder.build();
    return {
      ...event,
      data: {
        ...event.data,
        subscriptionId: args.subscriptionId,
        status: 'active',
        // Without a plan the payload is not a complete snapshot, so the
        // service re-fetches; the direct-payload tests below override this.
        planId: null,
        metadata: null,
        // Wire format: the billing service strips the dashes.
        customer: webhookEventCustomerBuilder()
          .with('upstreamCustomerId', stripDashes(spaceUuid))
          .build(),
        ...args.data,
      },
    };
  }

  it('writes the subscription and its purchased package from the re-fetch', async () => {
    const { spaceId, spaceUuid } = await seedSpace();

    // The event carries no plan, so this is the state the webhook re-fetches,
    // and therefore the state that must land in the database.
    const subscription = subscriptionBuilder()
      .with('status', 'active')
      .with('currentPeriodStart', PERIOD_START)
      .with('currentPeriodEnd', PERIOD_END)
      .with('plan', subscriptionPlanBuilder().build())
      .with('metadata', {
        FEATURE_SAFE_SEATS: '10',
        FEATURE_SECURITY_HUB: 'true',
      })
      .build();
    mockUpstreamSubscriptions(spaceUuid, [subscription]);

    await request(app.getHttpServer())
      .post(WEBHOOK_PATH)
      .send(
        webhookEventFor(spaceUuid, {
          type: 'customer.subscription.created',
          subscriptionId: subscription.id,
        }),
      )
      .expect(202);

    const subscriptionRepo =
      await postgresDatabaseService.getRepository(SpaceSubscription);
    const rows = await subscriptionRepo.find({
      where: { space: { id: spaceId } },
      relations: { entitlements: { feature: true } },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      upstreamSubscriptionId: subscription.id,
      status: 'active',
      planId: subscription.plan.id,
      planName: subscription.plan.name,
      // Epoch seconds converted to timestamptz on the way in.
      currentPeriodStart: new Date(PERIOD_START * 1_000),
      currentPeriodEnd: new Date(PERIOD_END * 1_000),
    });
    expect(
      rows[0].entitlements?.map((entitlement) => ({
        key: entitlement.feature.key,
        enabled: entitlement.enabled,
        quota: entitlement.quota,
        value: entitlement.value,
      })),
    ).toStrictEqual(
      expect.arrayContaining([
        { key: 'safe_seats', enabled: true, quota: 10, value: null },
        { key: 'security_hub', enabled: true, quota: null, value: null },
      ]),
    );
  });

  it('writes the subscription and its package straight from the event payload', async () => {
    const { spaceId, spaceUuid } = await seedSpace();
    const subscriptionId = faker.string.uuid();
    const planId = faker.string.alphanumeric(24);

    await request(app.getHttpServer())
      .post(WEBHOOK_PATH)
      .send(
        webhookEventFor(spaceUuid, {
          type: 'customer.subscription.created',
          subscriptionId,
          data: {
            planId,
            currentPeriodStart: PERIOD_START,
            currentPeriodEnd: PERIOD_END,
            metadata: {
              planName: 'Business',
              FEATURE_SAFE_SEATS: '10',
              FEATURE_SECURITY_HUB: 'true',
            },
          },
        }),
      )
      .expect(202);

    expect(networkService.get).not.toHaveBeenCalled();
    const subscriptionRepo =
      await postgresDatabaseService.getRepository(SpaceSubscription);
    const rows = await subscriptionRepo.find({
      where: { space: { id: spaceId } },
      relations: { entitlements: { feature: true } },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      upstreamSubscriptionId: subscriptionId,
      status: 'active',
      planId,
      planName: 'Business',
      currentPeriodStart: new Date(PERIOD_START * 1_000),
      currentPeriodEnd: new Date(PERIOD_END * 1_000),
    });
    expect(
      rows[0].entitlements?.map((entitlement) => ({
        key: entitlement.feature.key,
        enabled: entitlement.enabled,
        quota: entitlement.quota,
        value: entitlement.value,
      })),
    ).toStrictEqual(
      expect.arrayContaining([
        { key: 'safe_seats', enabled: true, quota: 10, value: null },
        { key: 'security_hub', enabled: true, quota: null, value: null },
      ]),
    );
  });

  // The whole point of the ordering mark: a delivery order that contradicts
  // event order must not resurrect a deleted subscription.
  it('does not let an update delivered after a deletion reactivate the subscription', async () => {
    const { spaceId, spaceUuid } = await seedSpace();
    const subscriptionId = faker.string.uuid();
    const planId = faker.string.alphanumeric(24);

    await request(app.getHttpServer())
      .post(WEBHOOK_PATH)
      .send(
        webhookEventFor(spaceUuid, {
          type: 'customer.subscription.deleted',
          subscriptionId,
          created: DELETED_AT,
          data: {
            status: 'canceled',
            planId,
            currentPeriodStart: PERIOD_START,
            currentPeriodEnd: PERIOD_END,
          },
        }),
      )
      .expect(202);

    // Upstream is the authority the late event is checked against, and it no
    // longer holds an active subscription.
    mockUpstreamSubscriptions(spaceUuid, [
      subscriptionBuilder()
        .with('id', subscriptionId)
        .with('status', 'canceled')
        .with('plan', subscriptionPlanBuilder().with('id', planId).build())
        .with('currentPeriodStart', PERIOD_START)
        .with('currentPeriodEnd', PERIOD_END)
        .with('metadata', null)
        .build(),
    ]);

    await request(app.getHttpServer())
      .post(WEBHOOK_PATH)
      .send(
        webhookEventFor(spaceUuid, {
          type: 'customer.subscription.updated',
          subscriptionId,
          created: UPDATED_AT,
          data: {
            status: 'active',
            planId,
            currentPeriodStart: PERIOD_START,
            currentPeriodEnd: PERIOD_END,
            metadata: { FEATURE_SAFE_SEATS: '10' },
          },
        }),
      )
      .expect(202);

    const subscriptionRepo =
      await postgresDatabaseService.getRepository(SpaceSubscription);
    const rows = await subscriptionRepo.find({
      where: { space: { id: spaceId } },
      relations: { entitlements: { feature: true } },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      upstreamSubscriptionId: subscriptionId,
      status: 'canceled',
      // The mark stays at the deletion, the newest event seen for the space.
      lastEventAt: new Date(DELETED_AT * 1_000),
    });
    expect(rows[0].entitlements).toStrictEqual([]);
    // The stale payload was not trusted: upstream was asked instead.
    expect(networkService.get).toHaveBeenCalled();
  });
});
