// SPDX-License-Identifier: FSL-1.1-MIT

import { generateKeyPairSync } from 'node:crypto';
import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { ObjectLiteral, Repository } from 'typeorm';
import {
  initTestApplication,
  TestAppProvider,
} from '@/__tests__/test-app.provider';
import { checkGuardIsApplied } from '@/__tests__/util/check-guard';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { mockPostgresDatabaseService } from '@/datasources/db/v2/__tests__/postgresql-database.service.mock';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { JWT_ES_ALGORITHM } from '@/datasources/jwt/jwt.constants';
import { jwtClientFactory } from '@/datasources/jwt/jwt.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { BillingModule } from '@/modules/billing/billing.module';
import { BillingAuthService } from '@/modules/billing/domain/billing-auth.service';
import type { BillingWebhookEvent } from '@/modules/billing/domain/entities/billing-webhook-event.entity';
import { BillingController } from '@/modules/billing/routes/billing.controller';
import { BillingWebhookAuthGuard } from '@/modules/billing/routes/guards/billing-webhook-auth.guard';
import { ZodErrorFilter } from '@/routes/common/filters/zod-error.filter';

const ISSUER = faker.internet.domainName();
const SUBJECT = faker.internet.domainWord();
const PATH = '/v1/billing/webhooks';

// Deliberately references no real Space — BillingWebhookService no-ops (and
// still acks 202) when it can't resolve upstreamCustomerId, which is all this
// suite needs since it's only testing the auth guard, not event processing.
const webhookEventBody: BillingWebhookEvent = {
  id: 'evt_test',
  type: 'customer.subscription.created',
  created: 1_700_000_000,
  data: {
    subscriptionId: 'sub_test',
    status: 'active',
    customer: { upstreamCustomerId: faker.string.uuid() },
  },
};

describe('BillingWebhookAuthGuard', () => {
  let app: INestApplication<Server>;
  let privateKey: string;
  let publicKey: string;

  const client = jwtClientFactory();

  /** Signs an ES256 token with the CGW private key (defaults to a valid service token). */
  function signServiceToken(
    overrides: Record<string, unknown> = {},
    options?: { algorithm?: 'ES256' | 'HS256'; secret?: string },
  ): string {
    return client.sign(
      {
        iss: ISSUER,
        sub: SUBJECT,
        aud: [ISSUER],
        exp: new Date(Date.now() + 60 * 60 * 1_000),
        roles: ['SERVICE_ACCESS'],
        data: {
          service_name: SUBJECT,
          permission_type: 'SERVICE_ACCESS',
          user_type: 'SERVICE_USER',
        },
        ...overrides,
      },
      {
        secretOrPrivateKey: options?.secret ?? privateKey,
        algorithm: options?.algorithm ?? JWT_ES_ALGORITHM,
      },
    );
  }

  beforeEach(async () => {
    ({ privateKey, publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    }));

    const baseConfiguration = configuration();
    const testConfiguration = (): typeof baseConfiguration => ({
      ...baseConfiguration,
      billing: {
        ...baseConfiguration.billing,
        webhook: {
          ...baseConfiguration.billing.webhook,
          publicKey,
          issuer: ISSUER,
        },
      },
    });

    // BillingModule pulls in SubscriptionsModule (Postgres-backed) to resolve
    // upstreamCustomerId to a Space — mocked here since this suite only cares
    // about the auth guard, not real Space/subscription lookups.
    mockPostgresDatabaseService.getRepository.mockResolvedValue({
      findOne: vi.fn().mockResolvedValue(null),
    } as unknown as Repository<ObjectLiteral>);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TestLoggingModule,
        TestCacheModule,
        TestNetworkModule,
        ConfigurationModule.register(testConfiguration),
        BillingModule,
      ],
      providers: [{ provide: APP_FILTER, useClass: ZodErrorFilter }],
    })
      .overrideModule(PostgresDatabaseModuleV2)
      .useModule(TestPostgresDatabaseModuleV2)
      .compile();

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterEach(async () => {
    await app?.close();
  });

  it('is applied to the webhook endpoint', () => {
    checkGuardIsApplied(
      BillingWebhookAuthGuard,
      BillingController.prototype.postWebhook,
    );
  });

  it('rejects a request without an Authorization header', async () => {
    await request(app.getHttpServer()).post(PATH).expect(401);
  });

  it('rejects a non-Bearer Authorization header', async () => {
    await request(app.getHttpServer())
      .post(PATH)
      .set('Authorization', `Basic ${faker.string.alphanumeric()}`)
      .expect(401);
  });

  it('rejects a Bearer header with an empty token', async () => {
    await request(app.getHttpServer())
      .post(PATH)
      .set('Authorization', 'Bearer   ')
      .expect(401);
  });

  it('rejects a malformed token', async () => {
    await request(app.getHttpServer())
      .post(PATH)
      .set('Authorization', `Bearer ${faker.string.alphanumeric()}`)
      .expect(401);
  });

  it('rejects a token signed with the wrong algorithm (HS256)', async () => {
    const token = signServiceToken(
      {},
      { algorithm: 'HS256', secret: faker.string.alphanumeric(32) },
    );

    await request(app.getHttpServer())
      .post(PATH)
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('rejects a token with the wrong issuer', async () => {
    const token = signServiceToken({ iss: faker.internet.domainName() });

    await request(app.getHttpServer())
      .post(PATH)
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('rejects a token with the wrong audience', async () => {
    const token = signServiceToken({ aud: [faker.internet.domainName()] });

    await request(app.getHttpServer())
      .post(PATH)
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('accepts a token whose audience list contains the expected issuer among others', async () => {
    const token = signServiceToken({
      aud: [ISSUER, faker.internet.domainName()],
    });

    await request(app.getHttpServer())
      .post(PATH)
      .set('Authorization', `Bearer ${token}`)
      .send(webhookEventBody)
      .expect(202);
  });

  it('rejects an expired token', async () => {
    const token = signServiceToken({ exp: new Date(Date.now() - 1_000) });

    await request(app.getHttpServer())
      .post(PATH)
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('rejects a validly-signed token that is not a service token', async () => {
    const token = signServiceToken({
      roles: [faker.string.alpha({ length: 10, casing: 'upper' })],
      data: undefined,
    });

    await request(app.getHttpServer())
      .post(PATH)
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('rejects a token signed by a different (untrusted) key', async () => {
    const { privateKey: otherPrivateKey } = generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const token = signServiceToken({}, { secret: otherPrivateKey });

    await request(app.getHttpServer())
      .post(PATH)
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('accepts a valid token minted by the provisioning helper', async () => {
    const token = BillingAuthService.mint({
      privateKey,
      issuer: ISSUER,
      expiresInDays: 365,
    });

    await request(app.getHttpServer())
      .post(PATH)
      .set('Authorization', `Bearer ${token}`)
      .send(webhookEventBody)
      .expect(202);
  });

  it('rejects a malformed webhook body once authenticated', async () => {
    const token = signServiceToken();

    await request(app.getHttpServer())
      .post(PATH)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'customer.subscription.created' }) // missing id/created/data
      .expect(422);
  });
});
