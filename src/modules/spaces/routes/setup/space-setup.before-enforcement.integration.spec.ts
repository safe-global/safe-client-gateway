// SPDX-License-Identifier: FSL-1.1-MIT

import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type postgres from 'postgres';
import request from 'supertest';
import type { MockedObject } from 'vitest';
import { TestDbFactory } from '#/__tests__/db.factory';
import {
  initTestApplication,
  TestAppProvider,
} from '#/__tests__/test-app.provider';
import { createTestModule } from '#/__tests__/testing-module';
import { IConfigurationService } from '#/config/configuration.service.interface';
import configuration from '#/config/entities/__tests__/configuration';
import { trialPaymentLinkBuilder } from '#/datasources/billing-api/entities/__tests__/payment-link.builder';
import type { PaymentLink } from '#/datasources/billing-api/entities/payment-link.entity';
import type { FakeCacheService } from '#/datasources/cache/__tests__/fake.cache.service';
import { CacheService } from '#/datasources/cache/cache.service.interface';
import { IJwtService } from '#/datasources/jwt/jwt.service.interface';
import {
  type INetworkService,
  NetworkService,
} from '#/datasources/network/network.service.interface';
import { siweAuthPayloadDtoBuilder } from '#/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { NotificationsRepositoryV2Module } from '#/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '#/modules/notifications/domain/v2/test.notification.repository.module';
import { spaceSetupSafeBuilder } from '#/modules/spaces/domain/setup/entities/__tests__/space-setup.builder';
import { createSpaceSetupDtoBuilder } from '#/modules/spaces/routes/entities/__tests__/create-space-setup.dto.builder';
import type { CreateSpaceSetupDto } from '#/modules/spaces/routes/entities/space-setup.dto.entity';
import { SpacesCreationRateLimitGuard } from '#/modules/spaces/routes/guards/spaces-creation-rate-limit.guard';
import {
  emptyBillingServiceState,
  mockBillingService,
} from '#/modules/spaces/routes/setup/__tests__/billing-service.mock';

/**
 * The Workspace setup before billing is enforced, as on a stack that leaves
 * ENTITLEMENTS_ENFORCEMENT_STARTS_AT unset: the request, not the date,
 * decides whether a trial checkout starts.
 */
describe('Workspace setup before enforcement', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let networkService: MockedObject<INetworkService>;
  let fakeCacheService: FakeCacheService;
  let billingBaseUri: string;
  let postLoginRedirectUri: string;

  const testDatabaseName = `test_${randomUUID().replaceAll('-', '')}`;
  const testDbFactory = new TestDbFactory();
  let testDatabase: postgres.Sql;

  beforeAll(async () => {
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
      entitlements: {
        ...defaultConfiguration.entitlements,
        enforcementStartsAt: faker.date.future(),
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
      cacheKeyPrefix: testDatabaseName,
      guards: [
        {
          originalGuard: SpacesCreationRateLimitGuard,
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

    jwtService = moduleFixture.get<IJwtService>(IJwtService);
    networkService = moduleFixture.get(NetworkService);
    fakeCacheService = moduleFixture.get<FakeCacheService>(CacheService);
    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    billingBaseUri = configurationService.getOrThrow('billing.baseUri');
    postLoginRedirectUri = configurationService.getOrThrow(
      'auth.postLoginRedirectUri',
    );

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  beforeEach(() => {
    fakeCacheService.clear();
  });

  afterAll(async () => {
    await app?.close();
    await testDbFactory.destroyTestDatabase(testDatabase);
  });

  /** Serves both trial offers, two sizes each, and answers their checkouts. */
  function mockBillingWithTrialCatalog(): void {
    mockBillingService({
      networkService,
      billingBaseUri,
      state: { ...emptyBillingServiceState(), catalog: trialCatalog() },
    });
  }

  /** Both trial offers, two sizes each, as the billing service lists them. */
  function trialCatalog(): Array<PaymentLink> {
    return [true, true, false, false].map((gracePeriod) =>
      trialPaymentLinkBuilder(gracePeriod).build(),
    );
  }

  async function getTrialPlans(
    accessToken: string,
  ): Promise<Array<PaymentLink>> {
    const response = await request(app.getHttpServer())
      .get('/v1/billing/trial-plans')
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(200);
    return response.body;
  }

  async function signIn(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/v1/users/wallet')
      .set('Cookie', [
        `access_token=${jwtService.sign(siweAuthPayloadDtoBuilder().build())}`,
      ])
      .expect(201);
    return jwtService.sign(
      siweAuthPayloadDtoBuilder().with('sub', String(response.body.id)).build(),
    );
  }

  function setupBody(paymentLinkId: string | null): CreateSpaceSetupDto {
    return createSpaceSetupDtoBuilder()
      .with('paymentLinkId', paymentLinkId)
      .with('safes', [spaceSetupSafeBuilder().with('chainId', '1').build()])
      .with('returnUrl', new URL('/welcome', postLoginRedirectUri).toString())
      .build();
  }

  async function getSpace(
    accessToken: string,
    spaceUuid: string,
  ): Promise<request.Response> {
    return await request(app.getHttpServer())
      .get(`/v1/spaces/${spaceUuid}`)
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(200);
  }

  it('starts the trial checkout when a plan is given', async () => {
    const accessToken = await signIn();
    mockBillingWithTrialCatalog();
    const [{ id: planId }] = await getTrialPlans(accessToken);

    const { body: created } = await request(app.getHttpServer())
      .post('/v1/spaces/setup')
      .set('Cookie', [`access_token=${accessToken}`])
      .send(setupBody(planId))
      .expect(201);

    expect(created.checkoutUrl).toEqual(expect.any(String));
    const { body: space } = await getSpace(accessToken, created.spaceId);
    expect(space).toEqual(
      expect.objectContaining({ setupStatus: 'pending', safeCount: 0 }),
    );
  });

  it('switches to another trial plan after a cancelled checkout', async () => {
    const accessToken = await signIn();
    mockBillingWithTrialCatalog();
    const [first, second] = await getTrialPlans(accessToken);
    const { body: created } = await request(app.getHttpServer())
      .post('/v1/spaces/setup')
      .set('Cookie', [`access_token=${accessToken}`])
      .send(setupBody(first.id))
      .expect(201);

    await request(app.getHttpServer())
      .put(`/v1/spaces/${created.spaceId}/setup`)
      .set('Cookie', [`access_token=${accessToken}`])
      .send(setupBody(second.id))
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          spaceId: created.spaceId,
          checkoutUrl: expect.any(String),
        });
      });
  });

  it('refuses a plan the trial plans do not offer, and writes nothing', async () => {
    const accessToken = await signIn();
    mockBillingWithTrialCatalog();

    await request(app.getHttpServer())
      .post('/v1/spaces/setup')
      .set('Cookie', [`access_token=${accessToken}`])
      .send(setupBody(faker.string.alphanumeric(17)))
      .expect(403);

    const { body: spaces } = await request(app.getHttpServer())
      .get('/v1/spaces')
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(200);
    expect(spaces).toEqual([]);
  });
});
