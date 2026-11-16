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
import { grantEntitlements } from '#/__tests__/util/space-fixtures';
import { IConfigurationService } from '#/config/configuration.service.interface';
import configuration from '#/config/entities/__tests__/configuration';
import {
  paymentLinkBuilder,
  trialPaymentLinkBuilder,
} from '#/datasources/billing-api/entities/__tests__/payment-link.builder';
import { subscriptionBuilder } from '#/datasources/billing-api/entities/__tests__/subscription.builder';
import type { PaymentLink } from '#/datasources/billing-api/entities/payment-link.entity';
import { stripDashes } from '#/datasources/billing-api/upstream-customer-id.util';
import type { FakeCacheService } from '#/datasources/cache/__tests__/fake.cache.service';
import { CacheService } from '#/datasources/cache/cache.service.interface';
import { PostgresDatabaseService } from '#/datasources/db/v2/postgres-database.service';
import { IJwtService } from '#/datasources/jwt/jwt.service.interface';
import {
  type INetworkService,
  NetworkService,
} from '#/datasources/network/network.service.interface';
import { nameBuilder } from '#/domain/common/entities/name.builder';
import { siweAuthPayloadDtoBuilder } from '#/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import {
  webhookEventBuilder,
  webhookEventCustomerBuilder,
} from '#/modules/billing/domain/entities/__tests__/webhook-event.builder';
import { BillingWebhookAuthGuard } from '#/modules/billing/routes/guards/billing-webhook-auth.guard';
import { EntitlementsService } from '#/modules/entitlements/routes/entitlements.service';
import { NotificationsRepositoryV2Module } from '#/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '#/modules/notifications/domain/v2/test.notification.repository.module';
import { SpaceSafe } from '#/modules/spaces/datasources/safes/entities/space-safes.entity.db';
import { SpaceSetup } from '#/modules/spaces/datasources/setup/entities/space-setup.entity.db';
import { Space } from '#/modules/spaces/datasources/spaces/entities/space.entity.db';
import { spaceSetupSafeBuilder } from '#/modules/spaces/domain/setup/entities/__tests__/space-setup.builder';
import { SPACE_SETUP_CHECKOUT_FAILED_MESSAGE } from '#/modules/spaces/domain/setup/errors/space-setup-checkout-failed.error';
import { ISpaceSetupApplier } from '#/modules/spaces/domain/setup/space-setup-applier.interface';
import { SETUP_APPLY_LEASE_SECONDS } from '#/modules/spaces/domain/setup/space-setup-claim.rules';
import { createSpaceSetupDtoBuilder } from '#/modules/spaces/routes/entities/__tests__/create-space-setup.dto.builder';
import type { CreateSpaceSetupDto } from '#/modules/spaces/routes/entities/space-setup.dto.entity';
import { SpacesCreationRateLimitGuard } from '#/modules/spaces/routes/guards/spaces-creation-rate-limit.guard';
import { emailInviteUserDtoBuilder } from '#/modules/spaces/routes/members/entities/__tests__/invite-user.dto.builder';
import {
  type BillingServiceState,
  emptyBillingServiceState,
  mockBillingService,
} from '#/modules/spaces/routes/setup/__tests__/billing-service.mock';
import { Member } from '#/modules/users/datasources/entities/member.entity.db';

const MAX_SPACE_CREATIONS = 3;
const SEATS = 2;

/**
 * The Workspace setup end to end: the routes, the real repositories and the
 * real subscription sync against a real database, with only the billing
 * service's HTTP answers mocked.
 */
describe('Workspace setup', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let networkService: MockedObject<INetworkService>;
  let postgresDatabaseService: PostgresDatabaseService;
  let billingBaseUri: string;
  let postLoginRedirectUri: string;

  let billing: BillingServiceState;
  let spaceSetupApplier: ISpaceSetupApplier;
  let entitlementsService: EntitlementsService;
  let fakeCacheService: FakeCacheService;

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
        // Enforcing, so a new Workspace starts its trial through checkout.
        enforcementStartsAt: faker.date.past(),
      },
      spaces: {
        ...defaultConfiguration.spaces,
        maxSpaceCreationsPerUser: MAX_SPACE_CREATIONS,
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
        // Webhook origin authentication has its own suite.
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

    jwtService = moduleFixture.get<IJwtService>(IJwtService);
    networkService = moduleFixture.get(NetworkService);
    postgresDatabaseService = moduleFixture.get(PostgresDatabaseService);
    fakeCacheService = moduleFixture.get<FakeCacheService>(CacheService);
    spaceSetupApplier =
      moduleFixture.get<ISpaceSetupApplier>(ISpaceSetupApplier);
    entitlementsService = moduleFixture.get(EntitlementsService);
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
    // The billing datasource caches the catalog each test redefines.
    fakeCacheService.clear();
    billing = emptyBillingServiceState();
    mockBillingService({ networkService, billingBaseUri, state: billing });
  });

  afterAll(async () => {
    await app?.close();
    await testDbFactory.destroyTestDatabase(testDatabase);
  });

  /** A standard trial plan with {@link SEATS} Safe seats, in the catalog. */
  function offerTrialPlan(): PaymentLink {
    const link = trialPaymentLinkBuilder(false).build();
    const plan = {
      ...link,
      metadata: { ...link.metadata, FEATURE_SAFE_SEATS: `${SEATS}` },
    };
    billing.catalog.push(plan);
    return plan;
  }

  /** The billing service now lists a trial for the Workspace. */
  function startTrial(spaceUuid: string): void {
    billing.subscriptionsByCustomer.set(stripDashes(spaceUuid), [
      subscriptionBuilder()
        .with('status', 'trialing')
        .with('upstreamCustomerId', stripDashes(spaceUuid))
        .with('metadata', {
          planCode: 'BUS-10-A',
          FEATURE_SAFE_SEATS: `${SEATS}`,
        })
        .build(),
    ]);
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

  function setupBody(plan: PaymentLink | null): CreateSpaceSetupDto {
    return createSpaceSetupDtoBuilder()
      .with('paymentLinkId', plan?.id ?? faker.string.alphanumeric(16))
      .with('safes', [spaceSetupSafeBuilder().with('chainId', '1').build()])
      .with('invites', [emailInviteUserDtoBuilder().build()])
      .with('returnUrl', new URL('/welcome', postLoginRedirectUri).toString())
      .build();
  }

  function postSetup(
    accessToken: string,
    body: CreateSpaceSetupDto,
  ): request.Test {
    return request(app.getHttpServer())
      .post('/v1/spaces/setup')
      .set('Cookie', [`access_token=${accessToken}`])
      .send(body);
  }

  function getSetup(accessToken: string, spaceUuid: string): request.Test {
    return request(app.getHttpServer())
      .get(`/v1/spaces/${spaceUuid}/setup`)
      .set('Cookie', [`access_token=${accessToken}`]);
  }

  async function countSpaces(accessToken: string): Promise<number> {
    const response = await request(app.getHttpServer())
      .get('/v1/spaces')
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(200);
    return response.body.length;
  }

  describe('GET /v1/billing/trial-plans', () => {
    it('lists the standard trial plans, without the grace or paid links', async () => {
      const accessToken = await signIn();
      const plan = offerTrialPlan();
      billing.catalog.push(
        trialPaymentLinkBuilder(true).build(),
        paymentLinkBuilder().build(),
      );

      await request(app.getHttpServer())
        .get('/v1/billing/trial-plans')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual([plan]);
        });
    });
  });

  describe('POST /v1/spaces/setup', () => {
    it('creates the Workspace with a pending setup and returns the checkout', async () => {
      const accessToken = await signIn();
      const body = setupBody(offerTrialPlan());

      const response = await postSetup(accessToken, body).expect(201);

      expect(response.body).toEqual({
        spaceId: expect.any(String),
        checkoutUrl: expect.any(String),
      });
      const spaces = await request(app.getHttpServer())
        .get('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);
      expect(spaces.body).toEqual([
        expect.objectContaining({
          uuid: response.body.spaceId,
          name: body.name,
          safeCount: 0,
          setupStatus: 'pending',
        }),
      ]);
      await getSetup(accessToken, response.body.spaceId)
        .expect(200)
        .expect(({ body: setup }) => {
          expect(setup).toEqual({
            status: 'pending',
            paymentLinkId: body.paymentLinkId,
            safes: body.safes,
            addressBookItems: body.addressBookItems,
            invites: body.invites,
            survey: null,
          });
        });
    });

    it('stores the payload as one JSON blob, not in plaintext columns', async () => {
      const accessToken = await signIn();
      const body = setupBody(offerTrialPlan());

      const { body: created } = await postSetup(accessToken, body).expect(201);

      const space = await (
        await postgresDatabaseService.getRepository(Space)
      ).findOneByOrFail({ uuid: created.spaceId });
      const row = await (
        await postgresDatabaseService.getRepository(SpaceSetup)
      ).findOneByOrFail({ spaceId: space.id });
      // Encryption is disabled in tests, so the KMS passthrough stores JSON.
      expect(JSON.parse(row.payload)).toEqual(
        expect.objectContaining({ version: 1, safes: body.safes }),
      );
      expect(row.status).toBe('PENDING');
    });

    it('refuses a plan that is not a trial plan, and writes nothing', async () => {
      const accessToken = await signIn();
      offerTrialPlan();

      await postSetup(accessToken, setupBody(null)).expect(403);

      await expect(countSpaces(accessToken)).resolves.toBe(0);
    });

    it('refuses a Workspace without a plan once billing is enforced', async () => {
      const accessToken = await signIn();
      offerTrialPlan();

      await postSetup(accessToken, {
        ...setupBody(null),
        paymentLinkId: null,
      }).expect(422);

      await expect(countSpaces(accessToken)).resolves.toBe(0);
    });

    it('refuses more Safes than the plan has seats, and writes nothing', async () => {
      const accessToken = await signIn();
      const body = {
        ...setupBody(offerTrialPlan()),
        safes: faker.helpers.multiple(
          () => spaceSetupSafeBuilder().with('chainId', '1').build(),
          { count: SEATS + 1 },
        ),
      };

      await postSetup(accessToken, body).expect(409);

      await expect(countSpaces(accessToken)).resolves.toBe(0);
    });

    it('counts one Safe on several chains as one seat', async () => {
      const accessToken = await signIn();
      const safe = spaceSetupSafeBuilder().with('chainId', '1').build();
      const body = {
        ...setupBody(offerTrialPlan()),
        safes: [safe, { ...safe, chainId: '10' }, { ...safe, chainId: '137' }],
      };

      await postSetup(accessToken, body).expect(201);
    });

    it('refuses a Workspace over the creation limit', async () => {
      const accessToken = await signIn();
      const plan = offerTrialPlan();
      for (let i = 0; i < MAX_SPACE_CREATIONS; i++) {
        await postSetup(accessToken, setupBody(plan)).expect(201);
      }

      await postSetup(accessToken, setupBody(plan)).expect(403);

      await expect(countSpaces(accessToken)).resolves.toBe(MAX_SPACE_CREATIONS);
    });

    it('answers 502 with the new Workspace id when the checkout cannot start', async () => {
      const accessToken = await signIn();
      billing.isCheckoutDown = true;

      const response = await postSetup(
        accessToken,
        setupBody(offerTrialPlan()),
      ).expect(502);

      expect(response.body).toEqual({
        statusCode: 502,
        message: SPACE_SETUP_CHECKOUT_FAILED_MESSAGE,
        spaceId: expect.any(String),
      });
      await getSetup(accessToken, response.body.spaceId)
        .expect(200)
        .expect(({ body }) => expect(body.status).toBe('pending'));
    });
  });

  describe('GET /v1/spaces/:id/setup', () => {
    it('applies the setup once the billing service lists the trial', async () => {
      const accessToken = await signIn();
      const body = setupBody(offerTrialPlan());
      const { body: created } = await postSetup(accessToken, body).expect(201);
      startTrial(created.spaceId);

      await getSetup(accessToken, created.spaceId)
        .expect(200)
        .expect(({ body: setup }) => expect(setup.status).toBe('applied'));

      const space = await request(app.getHttpServer())
        .get(`/v1/spaces/${created.spaceId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);
      expect(space.body).toEqual(
        expect.objectContaining({ safeCount: 1, setupStatus: 'applied' }),
      );
      expect(space.body.members).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: 'INVITED',
            name: body.invites[0].name,
          }),
        ]),
      );
    });

    it('answers 404 for a Workspace created without a setup', async () => {
      const accessToken = await signIn();
      const { body: space } = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: nameBuilder() })
        .expect(201);

      await getSetup(accessToken, space.uuid).expect(404);
    });

    it('answers 403 to a user who is not an admin of the Workspace', async () => {
      const accessToken = await signIn();
      const { body: created } = await postSetup(
        accessToken,
        setupBody(offerTrialPlan()),
      ).expect(201);

      await getSetup(await signIn(), created.spaceId).expect(403);
    });
  });

  describe('PUT /v1/spaces/:id/setup', () => {
    it('replaces the name and the form while the trial has not started', async () => {
      const accessToken = await signIn();
      const plan = offerTrialPlan();
      const { body: created } = await postSetup(
        accessToken,
        setupBody(plan),
      ).expect(201);
      const body = setupBody(plan);

      await request(app.getHttpServer())
        .put(`/v1/spaces/${created.spaceId}/setup`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(body)
        .expect(200)
        .expect(({ body: result }) => {
          expect(result).toEqual({
            spaceId: created.spaceId,
            checkoutUrl: expect.any(String),
          });
        });

      await getSetup(accessToken, created.spaceId).expect(({ body: setup }) => {
        expect(setup.safes).toEqual(body.safes);
        expect(setup.invites).toEqual(body.invites);
      });
      const space = await request(app.getHttpServer())
        .get(`/v1/spaces/${created.spaceId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);
      expect(space.body.name).toBe(body.name);
    });

    it('answers 409 once the trial has started and the setup is applied', async () => {
      const accessToken = await signIn();
      const plan = offerTrialPlan();
      const { body: created } = await postSetup(
        accessToken,
        setupBody(plan),
      ).expect(201);
      startTrial(created.spaceId);
      await getSetup(accessToken, created.spaceId).expect(200);

      await request(app.getHttpServer())
        .put(`/v1/spaces/${created.spaceId}/setup`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(setupBody(plan))
        .expect(409);
    });
  });

  describe('billing webhook', () => {
    it('applies the pending setup when the trial starts', async () => {
      const accessToken = await signIn();
      const { body: created } = await postSetup(
        accessToken,
        setupBody(offerTrialPlan()),
      ).expect(201);
      startTrial(created.spaceId);
      const event = webhookEventBuilder()
        .with('type', 'checkout.session.completed')
        .build();

      await request(app.getHttpServer())
        .post('/v1/billing/webhooks')
        .send({
          ...event,
          data: {
            ...event.data,
            planId: null,
            metadata: null,
            customer: webhookEventCustomerBuilder()
              .with('upstreamCustomerId', stripDashes(created.spaceId))
              .build(),
          },
        })
        .expect(202);

      const spaces = await request(app.getHttpServer())
        .get('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);
      expect(spaces.body).toEqual([
        expect.objectContaining({ safeCount: 1, setupStatus: 'applied' }),
      ]);
    });
  });

  describe('apply', () => {
    /**
     * A pending setup of a new Workspace, with one Safe and one invite, whose
     * plan grants the seats its Safe takes.
     */
    async function pendingSetup(): Promise<number> {
      const accessToken = await signIn();
      const { body: created } = await postSetup(
        accessToken,
        setupBody(offerTrialPlan()),
      ).expect(201);
      const space = await (
        await postgresDatabaseService.getRepository(Space)
      ).findOneByOrFail({ uuid: created.spaceId });
      await grantEntitlements({
        entitlementsService,
        spaceId: space.id,
        entitlements: [{ featureKey: 'safe_seats', quota: SEATS }],
      });
      return space.id;
    }

    async function setupStatus(spaceId: number): Promise<string> {
      const row = await (
        await postgresDatabaseService.getRepository(SpaceSetup)
      ).findOneByOrFail({ spaceId });
      return row.status;
    }

    async function countWrites(
      spaceId: number,
    ): Promise<{ safes: number; invites: number }> {
      const [safes, invites] = await Promise.all([
        (await postgresDatabaseService.getRepository(SpaceSafe)).countBy({
          space: { id: spaceId },
        }),
        (await postgresDatabaseService.getRepository(Member)).countBy({
          space: { id: spaceId },
          status: 'INVITED',
        }),
      ]);
      return { safes, invites };
    }

    async function markApplying(spaceId: number): Promise<void> {
      await (await postgresDatabaseService.getRepository(SpaceSetup)).update(
        { spaceId },
        { status: 'APPLYING' },
      );
    }

    it('writes the Safes and invites once when two applies run together', async () => {
      const spaceId = await pendingSetup();

      await Promise.all([
        spaceSetupApplier.apply(spaceId),
        spaceSetupApplier.apply(spaceId),
      ]);

      await expect(countWrites(spaceId)).resolves.toEqual({
        safes: 1,
        invites: 1,
      });
      await expect(setupStatus(spaceId)).resolves.toBe('APPLIED');
    });

    it('leaves a setup another apply holds within its lease', async () => {
      const spaceId = await pendingSetup();
      await markApplying(spaceId);

      await spaceSetupApplier.apply(spaceId);

      await expect(countWrites(spaceId)).resolves.toEqual({
        safes: 0,
        invites: 0,
      });
      await expect(setupStatus(spaceId)).resolves.toBe('APPLYING');
    });

    it('takes over a setup stuck in APPLYING once its lease has run out', async () => {
      const spaceId = await pendingSetup();
      await markApplying(spaceId);
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(Date.now() + (SETUP_APPLY_LEASE_SECONDS + 1) * 1_000);

      try {
        await spaceSetupApplier.apply(spaceId);
      } finally {
        vi.useRealTimers();
      }

      await expect(countWrites(spaceId)).resolves.toEqual({
        safes: 1,
        invites: 1,
      });
      await expect(setupStatus(spaceId)).resolves.toBe('APPLIED');
    });
  });
});
