// SPDX-License-Identifier: FSL-1.1-MIT

import { generateKeyPairSync } from 'node:crypto';
import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { checkGuardIsApplied } from '@/__tests__/util/check-guard';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { JWT_ES_ALGORITHM } from '@/datasources/jwt/jwt.constants';
import { jwtClientFactory } from '@/datasources/jwt/jwt.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { BillingModule } from '@/modules/billing/billing.module';
import { BillingAuthService } from '@/modules/billing/domain/billing-auth.service';
import { BillingController } from '@/modules/billing/routes/billing.controller';
import { BillingWebhookAuthGuard } from '@/modules/billing/routes/guards/billing-webhook-auth.guard';

const ISSUER = faker.internet.domainName();
const SUBJECT = faker.internet.domainWord();
const PATH = '/v1/billing/webhooks';

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
        webhook: {
          ...baseConfiguration.billing.webhook,
          publicKey,
          issuer: ISSUER,
        },
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TestLoggingModule,
        ConfigurationModule.register(testConfiguration),
        BillingModule,
      ],
    }).compile();

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
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
      .expect(202);
  });
});
