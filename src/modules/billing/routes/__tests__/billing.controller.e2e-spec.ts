// SPDX-License-Identifier: FSL-1.1-MIT

import { type Server } from 'node:http';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { MockedObject } from 'vitest';
import {
  initTestApplication,
  TestAppProvider,
} from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { checkGuardIsApplied } from '@/__tests__/util/check-guard';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import {
  checkoutSessionBuilder,
  checkoutSessionResultBuilder,
} from '@/datasources/billing-api/entities/__tests__/checkout-session.builder';
import {
  paymentLinkBuilder,
  trialPaymentLinkBuilder,
} from '@/datasources/billing-api/entities/__tests__/payment-link.builder';
import { planBuilder } from '@/datasources/billing-api/entities/__tests__/plan.builder';
import { subscriptionBuilder } from '@/datasources/billing-api/entities/__tests__/subscription.builder';
import type { PaymentLink } from '@/datasources/billing-api/entities/payment-link.entity';
import type { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheService } from '@/datasources/cache/cache.service.interface';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import {
  type INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { BillingController } from '@/modules/billing/routes/billing.controller';
import { BillingWebhookAuthGuard } from '@/modules/billing/routes/guards/billing-webhook-auth.guard';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/test.notification.repository.module';
import { SpacesCreationRateLimitGuard } from '@/modules/spaces/routes/guards/spaces-creation-rate-limit.guard';
import { rawify } from '@/validation/entities/raw.entity';

describe('BillingController', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let networkService: MockedObject<INetworkService>;
  let billingBaseUri: string;
  let postLoginRedirectUri: string;
  let fakeCacheService: FakeCacheService;

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
      entitlements: {
        ...defaultConfiguration.entitlements,
        // In the past, so a workspace a spec creates now reads as
        // post-enforcement and is offered the standard trial rather than the
        // legacy grace. The shared default is a future date instead (safe for
        // suites unrelated to billing: enforcement stays inactive).
        enforcementStartsAt: new Date('2020-01-01T00:00:00Z'),
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
      guards: [
        {
          originalGuard: SpacesCreationRateLimitGuard,
          testGuard: {
            canActivate: (): true => true,
          },
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

  afterEach(() => {
    networkService.get.mockReset();
    networkService.post.mockReset();
    // The general payment-link catalog is cached under a customer-independent
    // key, so without this a previous test's catalog is served to the next one.
    fakeCacheService.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerAndCreateSpace(): Promise<{
    accessToken: string;
    spaceId: string;
  }> {
    const authPayloadDto = siweAuthPayloadDtoBuilder().build();
    const accessToken = jwtService.sign(authPayloadDto);

    await request(app.getHttpServer())
      .post('/v1/users/wallet')
      .set('Cookie', [`access_token=${accessToken}`]);

    const createSpaceResponse = await request(app.getHttpServer())
      .post('/v1/spaces')
      .set('Cookie', [`access_token=${accessToken}`])
      .send({ name: nameBuilder() });

    return { accessToken, spaceId: createSpaceResponse.body.uuid };
  }

  /**
   * Serves the payment-link catalog, split the way the datasource asks for it:
   * `spaceSpecific` answers the customer-scoped call, `general` the shared one.
   */
  function mockPaymentLinkCatalog(args: {
    general?: Array<PaymentLink>;
    spaceSpecific?: Array<PaymentLink>;
  }): void {
    networkService.get.mockImplementation(({ url, networkRequest }) => {
      if (url === `${billingBaseUri}/api/v1/payment-links`) {
        const customerId = (
          networkRequest?.params as { customerId?: string } | undefined
        )?.customerId;
        return Promise.resolve({
          data: rawify({
            paymentLinks: customerId
              ? (args.spaceSpecific ?? [])
              : (args.general ?? []),
          }),
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
  }

  it('should require authentication for every space/session/plan endpoint', () => {
    const endpoints = [
      BillingController.prototype.getSubscriptions,
      BillingController.prototype.getPlan,
      BillingController.prototype.getSessionUrl,
      BillingController.prototype.getSpacePaymentLinks,
      BillingController.prototype.getCheckoutUrl,
      BillingController.prototype.getCheckoutSession,
    ];
    for (const fn of endpoints) {
      checkGuardIsApplied(AuthGuard, fn);
    }
  });

  it('should protect the webhook endpoint with BillingWebhookAuthGuard', () => {
    checkGuardIsApplied(
      BillingWebhookAuthGuard,
      BillingController.prototype.postWebhook,
    );
  });

  it('GET /v1/billing/plans/:planId requires authentication', async () => {
    await request(app.getHttpServer())
      .get(`/v1/billing/plans/${faker.string.alphanumeric(10)}`)
      .expect(403);
  });

  it('GET /v1/billing/spaces/:spaceId/subscriptions returns 400 for a malformed spaceId', async () => {
    const { accessToken } = await registerAndCreateSpace();

    await request(app.getHttpServer())
      .get('/v1/billing/spaces/not-a-uuid/subscriptions')
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(400);
  });

  it('GET /v1/billing/spaces/:spaceId/subscriptions returns 403 for a non-member', async () => {
    const { spaceId } = await registerAndCreateSpace();
    const otherAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
    const otherAccessToken = jwtService.sign(otherAuthPayloadDto);
    await request(app.getHttpServer())
      .post('/v1/users/wallet')
      .set('Cookie', [`access_token=${otherAccessToken}`]);

    await request(app.getHttpServer())
      .get(`/v1/billing/spaces/${spaceId}/subscriptions`)
      .set('Cookie', [`access_token=${otherAccessToken}`])
      .expect(403);
  });

  it('GET /v1/billing/spaces/:spaceId/subscriptions returns the space subscriptions', async () => {
    const { accessToken, spaceId } = await registerAndCreateSpace();
    const subscription = subscriptionBuilder().build();
    networkService.get.mockImplementation(({ url }) => {
      if (url.startsWith(`${billingBaseUri}/api/v1/customers/`)) {
        return Promise.resolve({
          data: rawify({ subscriptions: [subscription] }),
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(`/v1/billing/spaces/${spaceId}/subscriptions`)
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0].id).toBe(subscription.id);
      });
  });

  it('GET /v1/billing/plans/:planId returns 422 for a malformed planId', async () => {
    const { accessToken } = await registerAndCreateSpace();

    await request(app.getHttpServer())
      .get(`/v1/billing/plans/${encodeURIComponent('not a valid id!!')}`)
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(422);
  });

  it('GET /v1/billing/plans/:planId returns the plan', async () => {
    const { accessToken } = await registerAndCreateSpace();
    const plan = planBuilder().build();
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${billingBaseUri}/api/v1/plans/${plan.id}`) {
        return Promise.resolve({ data: rawify(plan), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(`/v1/billing/plans/${plan.id}`)
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(plan.id);
      });
  });

  it('GET /v1/billing/spaces/:spaceId/session-url returns 400 when returnUrl targets a disallowed origin', async () => {
    const { accessToken, spaceId } = await registerAndCreateSpace();

    await request(app.getHttpServer())
      .get(`/v1/billing/spaces/${spaceId}/session-url`)
      .query({ returnUrl: faker.internet.url() })
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(400);

    expect(networkService.get).not.toHaveBeenCalled();
  });

  it('GET /v1/billing/spaces/:spaceId/payment-links prefers the space-specific link on a shared id', async () => {
    const { accessToken, spaceId } = await registerAndCreateSpace();
    const sharedId = faker.string.uuid();
    const spaceLink = paymentLinkBuilder()
      .with('id', sharedId)
      .with('active', true)
      .build();
    const generalLink = paymentLinkBuilder()
      .with('id', sharedId)
      .with('active', false)
      .build();
    // A never-subscribed space is not offered a plain paid link
    const onlyGeneralLink = trialPaymentLinkBuilder(false).build();

    mockPaymentLinkCatalog({
      general: [generalLink, onlyGeneralLink],
      spaceSpecific: [spaceLink],
    });

    await request(app.getHttpServer())
      .get(`/v1/billing/spaces/${spaceId}/payment-links`)
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(2);
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: sharedId, active: true }),
            expect.objectContaining({ id: onlyGeneralLink.id }),
          ]),
        );
      });
  });

  it('GET /v1/billing/spaces/:spaceId/payment-links returns 403 without an access token', async () => {
    const { spaceId } = await registerAndCreateSpace();

    await request(app.getHttpServer())
      .get(`/v1/billing/spaces/${spaceId}/payment-links`)
      .expect(403);

    expect(networkService.get).not.toHaveBeenCalled();
  });

  it('GET /v1/billing/spaces/:spaceId/payment-links drops the offers the space is not entitled to', async () => {
    const { accessToken, spaceId } = await registerAndCreateSpace();
    // The space is created now, and the test configuration's enforcement date
    // is in the past, so it is a post-enforcement, never-subscribed
    // workspace: only the standard trial — never the legacy grace, and no
    // paid link until it has picked a plan.
    const graceLink = trialPaymentLinkBuilder(true).build();
    const trialLink = trialPaymentLinkBuilder(false).build();
    const paidLink = paymentLinkBuilder().build();

    mockPaymentLinkCatalog({ general: [graceLink, trialLink, paidLink] });

    await request(app.getHttpServer())
      .get(`/v1/billing/spaces/${spaceId}/payment-links`)
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((link: { id: string }) => link.id)).toEqual([
          trialLink.id,
        ]);
      });
  });

  it('GET /v1/billing/spaces/:spaceId/payment-links always offers a space-specific link', async () => {
    const { accessToken, spaceId } = await registerAndCreateSpace();
    // Negotiated for this customer, untagged: the general-catalog enforcement
    // filter would drop it, but a space-specific link is not subject to it.
    const negotiatedLink = paymentLinkBuilder()
      .with('trialPeriodDays', faker.number.int({ min: 1, max: 365 }))
      .build();

    mockPaymentLinkCatalog({ spaceSpecific: [negotiatedLink] });

    await request(app.getHttpServer())
      .get(`/v1/billing/spaces/${spaceId}/payment-links`)
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(200)
      .expect(({ body }) => {
        expect(body.map((link: { id: string }) => link.id)).toEqual([
          negotiatedLink.id,
        ]);
      });
  });

  describe('GET /v1/billing/spaces/:spaceId/payment-links/:paymentLinkId/checkout-url', () => {
    it('returns 403 without an access token', async () => {
      const { spaceId } = await registerAndCreateSpace();

      await request(app.getHttpServer())
        .get(
          `/v1/billing/spaces/${spaceId}/payment-links/${faker.string.alphanumeric(20)}/checkout-url`,
        )
        .query({ returnUrl: postLoginRedirectUri })
        .expect(403);

      expect(networkService.post).not.toHaveBeenCalled();
    });

    it('returns 422 for a malformed paymentLinkId', async () => {
      const { accessToken, spaceId } = await registerAndCreateSpace();

      await request(app.getHttpServer())
        .get(
          `/v1/billing/spaces/${spaceId}/payment-links/${encodeURIComponent('not valid!!')}/checkout-url`,
        )
        .query({ returnUrl: postLoginRedirectUri })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(422);
    });

    it('returns 400 when returnUrl targets a disallowed origin', async () => {
      const { accessToken, spaceId } = await registerAndCreateSpace();

      await request(app.getHttpServer())
        .get(
          `/v1/billing/spaces/${spaceId}/payment-links/${faker.string.alphanumeric(10)}/checkout-url`,
        )
        .query({ returnUrl: faker.internet.url() })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(400);

      expect(networkService.post).not.toHaveBeenCalled();
    });

    it('creates a checkout session', async () => {
      const { accessToken, spaceId } = await registerAndCreateSpace();
      const paymentLinkId = faker.string.alphanumeric(20);
      const checkoutSessionResult = checkoutSessionResultBuilder().build();
      // The standard trial, which a post-enforcement never-subscribed space is
      // offered — so the checkout is not rejected by the offer filter.
      const offeredLink = trialPaymentLinkBuilder(false)
        .with('id', paymentLinkId)
        .build();
      mockPaymentLinkCatalog({ general: [offeredLink] });
      networkService.post.mockImplementation(({ url }) => {
        if (
          url ===
          `${billingBaseUri}/api/v1/payment-links/${paymentLinkId}/checkout`
        ) {
          return Promise.resolve({
            data: rawify(checkoutSessionResult),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(
          `/v1/billing/spaces/${spaceId}/payment-links/${paymentLinkId}/checkout-url`,
        )
        .query({ returnUrl: postLoginRedirectUri })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body.sessionId).toBe(checkoutSessionResult.sessionId);
        });
    });

    it('returns 403 for a payment link the space is not offered', async () => {
      const { accessToken, spaceId } = await registerAndCreateSpace();
      // The legacy grace, which a space created now is not entitled to.
      const graceLink = trialPaymentLinkBuilder(true)
        .with('id', faker.string.alphanumeric(20))
        .build();
      mockPaymentLinkCatalog({ general: [graceLink] });

      await request(app.getHttpServer())
        .get(
          `/v1/billing/spaces/${spaceId}/payment-links/${graceLink.id}/checkout-url`,
        )
        .query({ returnUrl: postLoginRedirectUri })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403);

      expect(networkService.post).not.toHaveBeenCalled();
    });
  });

  describe('GET /v1/billing/sessions/:sessionId', () => {
    it('returns 422 for a malformed sessionId', async () => {
      const { accessToken } = await registerAndCreateSpace();

      await request(app.getHttpServer())
        .get(`/v1/billing/sessions/${encodeURIComponent('not a valid id!!')}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(422);
    });

    it('returns the session, tolerating a null url (completed/expired session)', async () => {
      const { accessToken } = await registerAndCreateSpace();
      const sessionId = faker.string.alphanumeric(32);
      const checkoutSession = checkoutSessionBuilder()
        .with('id', sessionId)
        .with('url', null)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${billingBaseUri}/api/v1/sessions/${sessionId}`) {
          return Promise.resolve({
            data: rawify(checkoutSession),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(`/v1/billing/sessions/${sessionId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body.id).toBe(sessionId);
          expect(body.url).toBeNull();
        });
    });
  });
});
