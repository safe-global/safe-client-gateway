// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { MockedObject } from 'vitest';
import {
  initTestApplication,
  TestAppProvider,
} from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { subscriptionPlanBuilder } from '@/datasources/billing-api/entities/__tests__/plan.builder';
import { subscriptionBuilder } from '@/datasources/billing-api/entities/__tests__/subscription.builder';
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
import { BillingWebhookAuthGuard } from '@/modules/billing/routes/guards/billing-webhook-auth.guard';
import { Feature } from '@/modules/entitlements/datasources/entities/feature.entity.db';
import { SpaceSubscription } from '@/modules/entitlements/datasources/entities/space-subscription.entity.db';
import { featureBuilder } from '@/modules/entitlements/domain/entities/__tests__/feature.builder';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/test.notification.repository.module';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { rawify } from '@/validation/entities/raw.entity';

const WEBHOOK_PATH = '/v1/billing/webhooks';
// Epoch seconds, as the billing service sends them; asserted below, so they
// stay literal rather than faker-random.
const PERIOD_START = 1_700_000_000;
const PERIOD_END = 1_702_592_000;

describe('Billing webhook → entitlements materialization', () => {
  let app: INestApplication<Server>;
  let networkService: MockedObject<INetworkService>;
  let postgresDatabaseService: PostgresDatabaseService;
  let billingBaseUri: string;

  beforeAll(async () => {
    vi.resetAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
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
  });

  afterEach(async () => {
    networkService.get.mockReset();
    const subscriptionRepo =
      await postgresDatabaseService.getRepository(SpaceSubscription);
    const featureRepo = await postgresDatabaseService.getRepository(Feature);
    await subscriptionRepo.createQueryBuilder().delete().execute();
    await featureRepo.createQueryBuilder().delete().execute();
  });

  afterAll(async () => {
    await app?.close();
  });

  async function seedSpace(): Promise<{ spaceId: number; spaceUuid: string }> {
    const spaceRepo = await postgresDatabaseService.getRepository(Space);
    const insert = await spaceRepo.insert({
      name: nameBuilder(),
      status: 'ACTIVE',
    });
    const spaceId = insert.identifiers[0].id as number;
    // uuid is filled by the DB default (gen_random_uuid()), so read it back.
    const space = await spaceRepo.findOneByOrFail({ id: spaceId });
    return { spaceId, spaceUuid: space.uuid };
  }

  async function seedFeatures(): Promise<void> {
    const featureRepo = await postgresDatabaseService.getRepository(Feature);
    await featureRepo.insert([
      featureBuilder()
        .with('key', 'safe_seats')
        .with('type', 'metered')
        .build(),
      featureBuilder()
        .with('key', 'security_hub')
        .with('type', 'binary')
        .build(),
    ]);
  }

  it('writes the subscription and its purchased package on a checkout event', async () => {
    const { spaceId, spaceUuid } = await seedSpace();
    await seedFeatures();

    // The event is only a trigger: this is the state the webhook re-fetches,
    // and therefore the state that must land in the database.
    const subscription = subscriptionBuilder()
      .with('status', 'active')
      .with('startAt', PERIOD_START)
      .with('validUntil', PERIOD_END)
      .with(
        'plan',
        subscriptionPlanBuilder().with('features', ['security_hub']).build(),
      )
      .with('metadata', { FEATURE_SAFE_SEATS: '10' })
      .build();
    networkService.get.mockImplementation(({ url }) =>
      url ===
      `${billingBaseUri}/api/v1/customers/${stripDashes(spaceUuid)}/subscriptions`
        ? Promise.resolve({
            data: rawify({ subscriptions: [subscription] }),
            status: 200,
          })
        : Promise.reject(new Error(`Could not match ${url}`)),
    );

    await request(app.getHttpServer())
      .post(WEBHOOK_PATH)
      .send(
        webhookEventBuilder()
          .with('type', 'checkout.session.completed')
          .with('data', {
            subscriptionId: subscription.id,
            status: 'active',
            metadata: null,
            customer: webhookEventCustomerBuilder()
              // Wire format: the billing service strips the dashes.
              .with('upstreamCustomerId', stripDashes(spaceUuid))
              .build(),
          })
          .build(),
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
        // From the FEATURE_* metadata.
        { key: 'safe_seats', enabled: true, quota: 10, value: null },
        // From the plan's feature list.
        { key: 'security_hub', enabled: true, quota: null, value: null },
      ]),
    );
  });

  it('is idempotent: redelivering the same event leaves one subscription row', async () => {
    const { spaceId, spaceUuid } = await seedSpace();
    await seedFeatures();

    const subscription = subscriptionBuilder()
      .with('status', 'active')
      .with('startAt', PERIOD_START)
      .with('validUntil', PERIOD_END)
      .with('metadata', { FEATURE_SAFE_SEATS: '10' })
      .build();
    networkService.get.mockImplementation(({ url }) =>
      url ===
      `${billingBaseUri}/api/v1/customers/${stripDashes(spaceUuid)}/subscriptions`
        ? Promise.resolve({
            data: rawify({ subscriptions: [subscription] }),
            status: 200,
          })
        : Promise.reject(new Error(`Could not match ${url}`)),
    );
    const event = webhookEventBuilder()
      .with('type', 'customer.subscription.updated')
      .with('data', {
        subscriptionId: subscription.id,
        status: 'active',
        metadata: null,
        customer: webhookEventCustomerBuilder()
          .with('upstreamCustomerId', stripDashes(spaceUuid))
          .build(),
      })
      .build();

    for (const _ of [1, 2]) {
      await request(app.getHttpServer())
        .post(WEBHOOK_PATH)
        .send(event)
        .expect(202);
    }

    const subscriptionRepo =
      await postgresDatabaseService.getRepository(SpaceSubscription);
    const rows = await subscriptionRepo.find({
      where: { space: { id: spaceId } },
      relations: { entitlements: true },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].entitlements).toHaveLength(1);
  });

  it('acks without writing when the event references an unknown workspace', async () => {
    await seedFeatures();

    await request(app.getHttpServer())
      .post(WEBHOOK_PATH)
      .send(webhookEventBuilder().build())
      .expect(202);

    const subscriptionRepo =
      await postgresDatabaseService.getRepository(SpaceSubscription);
    expect(await subscriptionRepo.count()).toBe(0);
    expect(networkService.get).not.toHaveBeenCalled();
  });
});
