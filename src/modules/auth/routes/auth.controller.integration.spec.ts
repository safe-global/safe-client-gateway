// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createSiweMessage } from 'viem/siwe';
import type { MockedObject } from 'vitest';
import {
  initTestApplication,
  TestAppProvider,
} from '#/__tests__/test-app.provider';
import { createTestModule } from '#/__tests__/testing-module';
import { IConfigurationService } from '#/config/configuration.service.interface';
import configuration from '#/config/entities/__tests__/configuration';
import type { FakeCacheService } from '#/datasources/cache/__tests__/fake.cache.service';
import { CacheService } from '#/datasources/cache/cache.service.interface';
import { CacheDir } from '#/datasources/cache/entities/cache-dir.entity';
import { IJwtService } from '#/datasources/jwt/jwt.service.interface';
import { getSecondsUntil } from '#/domain/common/utils/time';
import {
  oidcAuthPayloadDtoBuilder,
  siweAuthPayloadDtoBuilder,
} from '#/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { MIN_TOKEN_LIFETIME_SECONDS } from '#/modules/auth/utils/token-expiration.utils';
import { siweMessageBuilder } from '#/modules/siwe/domain/entities/__tests__/siwe-message.builder';
import { TestUsersModule } from '#/modules/users/__tests__/test.users.module';
import { IUsersRepository } from '#/modules/users/domain/users.repository.interface';
import { UsersModule } from '#/modules/users/users.module';
import { fakeEmailAddress } from '#/validation/entities/schemas/__tests__/email-address.builder';

describe('AuthController', () => {
  let app: INestApplication<Server>;
  let cacheService: FakeCacheService;
  let jwtService: IJwtService;
  let usersRepository: MockedObject<IUsersRepository>;

  let maxValidityPeriodInMs: number;
  let clockSkewInMs: number;

  // Past the minimum token lifetime, with a second to spare for a sub-second clock
  function getAcceptedExpirationTime(): Date {
    return faker.date.between({
      from: new Date(Date.now() + (MIN_TOKEN_LIFETIME_SECONDS + 1) * 1_000),
      to: new Date(Date.now() + maxValidityPeriodInMs),
    });
  }

  // Leaves room for an accepted expiry within the max validity period
  function getMaxValidityPeriodSeconds(): number {
    return faker.number.int({
      min: MIN_TOKEN_LIFETIME_SECONDS + 1,
      max: 60 * 1_000,
    });
  }

  async function initApp(config: typeof configuration): Promise<void> {
    await app?.close();
    const moduleFixture: TestingModule = await createTestModule({
      config,
      modules: [
        {
          originalModule: UsersModule,
          testModule: TestUsersModule,
        },
      ],
    });

    cacheService = moduleFixture.get(CacheService);
    jwtService = moduleFixture.get(IJwtService);
    usersRepository = moduleFixture.get(IUsersRepository);

    const configService: IConfigurationService = moduleFixture.get(
      IConfigurationService,
    );

    maxValidityPeriodInMs =
      configService.getOrThrow<number>('auth.maxValidityPeriodSeconds') * 1_000;
    clockSkewInMs =
      configService.getOrThrow<number>('auth.clockSkewSeconds') * 1_000;

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      application: {
        ...defaultConfiguration.application,
        isProduction: true,
      },
      auth: {
        ...defaultConfiguration.auth,
        maxValidityPeriodSeconds: getMaxValidityPeriodSeconds(),
      },
      features: {
        ...defaultConfiguration.features,
        auth: true,
      },
    });

    await initApp(testConfiguration);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await app?.close();
  });

  describe('GET /v1/auth/nonce', () => {
    it('should return a nonce', async () => {
      await request(app.getHttpServer())
        .get('/v1/auth/nonce')
        .expect(200)
        .expect(async ({ body }) => {
          expect(body).toStrictEqual({
            nonce: expect.any(String),
          });

          const cacheDir = new CacheDir(`auth_nonce_${body.nonce}`, '');
          await expect(cacheService.hGet(cacheDir)).resolves.toBe(body.nonce);
        });
    });
  });

  describe('POST /v1/auth/verify', () => {
    it('should verify a signer', async () => {
      // Fix "now" as it is otherwise to precisely expect expiration/maxAge
      vi.setSystemTime(0);

      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const cacheDir = new CacheDir(`auth_nonce_${nonce}`, '');
      const expirationTime = getAcceptedExpirationTime();
      const message = createSiweMessage(
        siweMessageBuilder()
          .with('address', signer.address)
          .with('nonce', nonce)
          .with('expirationTime', expirationTime)
          .build(),
      );
      const signature = await signer.signMessage({
        message,
      });
      const maxAge = getSecondsUntil(expirationTime);

      await expect(cacheService.hGet(cacheDir)).resolves.toBe(
        nonceResponse.body.nonce,
      );
      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({
          message,
          signature,
        })
        .expect(200)
        .expect(({ headers }) => {
          const setCookie = headers['set-cookie'];
          const setCookieRegExp = new RegExp(
            `access_token=([^;]*); Max-Age=${maxAge}; Path=/; Expires=${expirationTime.toUTCString()}; HttpOnly; Secure; SameSite=Lax`,
          );

          expect(setCookie).toHaveLength(1);
          expect(setCookie[0]).toMatch(setCookieRegExp);
        });
      // Nonce deleted
      await expect(cacheService.hGet(cacheDir)).resolves.toBeNull();
    });

    it('should set SameSite=none if application.env is not production', async () => {
      // Fix "now" as it is otherwise to precisely expect expiration/maxAge
      vi.setSystemTime(0);

      const defaultConfiguration = configuration();
      const testConfiguration = (): typeof defaultConfiguration => ({
        ...defaultConfiguration,
        application: {
          ...defaultConfiguration.application,
          isProduction: false,
        },
        auth: {
          ...defaultConfiguration.auth,
          maxValidityPeriodSeconds: getMaxValidityPeriodSeconds(),
        },
        features: {
          ...defaultConfiguration.features,
          auth: true,
        },
      });

      await initApp(testConfiguration);

      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const cacheDir = new CacheDir(`auth_nonce_${nonce}`, '');
      const expirationTime = getAcceptedExpirationTime();
      const message = createSiweMessage(
        siweMessageBuilder()
          .with('address', signer.address)
          .with('nonce', nonce)
          .with('expirationTime', expirationTime)
          .build(),
      );
      const signature = await signer.signMessage({
        message,
      });
      const maxAge = getSecondsUntil(expirationTime);

      await expect(cacheService.hGet(cacheDir)).resolves.toBe(
        nonceResponse.body.nonce,
      );

      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({
          message,
          signature,
        })
        .expect(200)
        .expect(({ headers }) => {
          const setCookie = headers['set-cookie'];
          const setCookieRegExp = new RegExp(
            `access_token=([^;]*); Max-Age=${maxAge}; Path=/; Expires=${expirationTime.toUTCString()}; HttpOnly; Secure; SameSite=None`,
          );

          expect(setCookie).toHaveLength(1);
          expect(setCookie[0]).toMatch(setCookieRegExp);
        });
      // Nonce deleted
      await expect(cacheService.hGet(cacheDir)).resolves.toBeNull();
    });

    it('should not issue an access token if expirationTime is too high', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const cacheDir = new CacheDir(`auth_nonce_${nonce}`, '');
      const expirationTime = faker.date.future({
        refDate: new Date(Date.now() + maxValidityPeriodInMs),
      });
      const message = createSiweMessage(
        siweMessageBuilder()
          .with('address', signer.address)
          .with('nonce', nonce)
          .with('expirationTime', expirationTime)
          .build(),
      );
      const signature = await signer.signMessage({
        message,
      });

      await expect(cacheService.hGet(cacheDir)).resolves.toBe(nonce);
      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({
          message,
          signature,
        })
        .expect(403)
        .expect(({ headers, body }) => {
          expect(headers['set-cookie']).toBeUndefined();

          expect(body).toStrictEqual({
            error: 'Forbidden',
            message: `Cannot issue token for longer than ${maxValidityPeriodInMs / 1_000} seconds`,
            statusCode: 403,
          });
        });
      // Nonce deleted
      await expect(cacheService.hGet(cacheDir)).resolves.toBeNull();
    });

    it('should not verify a signer if using an unsigned nonce', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const expirationTime = faker.date.between({
        from: new Date(),
        to: new Date(Date.now() + maxValidityPeriodInMs),
      });
      const siweMessage = siweMessageBuilder()
        .with('address', signer.address)
        .with('expirationTime', expirationTime)
        .build();
      const message = createSiweMessage(siweMessage);
      const cacheDir = new CacheDir(`auth_nonce_${siweMessage.nonce}`, '');
      const signature = await signer.signMessage({
        message,
      });

      await expect(cacheService.hGet(cacheDir)).resolves.toBeNull();
      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({
          message,
          signature,
        })
        .expect(401)
        .expect(({ headers, body }) => {
          expect(headers['set-cookie']).toBeUndefined();

          expect(body).toStrictEqual({
            error: 'Unauthorized',
            message: 'Invalid nonce',
            statusCode: 401,
          });
        });
      // Nonce deleted
      await expect(cacheService.hGet(cacheDir)).resolves.toBeNull();
    });

    it('should not verify a signer if the nonce has expired', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const cacheDir = new CacheDir(`auth_nonce_${nonce}`, '');
      const expirationTime = faker.date.between({
        from: new Date(),
        to: new Date(Date.now() + maxValidityPeriodInMs),
      });
      const message = createSiweMessage(
        siweMessageBuilder()
          .with('address', signer.address)
          .with('nonce', nonce)
          .with('expirationTime', expirationTime)
          .build(),
      );
      const signature = await signer.signMessage({
        message,
      });

      // Mimic ttl expiration
      await cacheService.deleteByKey(cacheDir.key);

      await expect(cacheService.hGet(cacheDir)).resolves.toBeNull();
      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .set(
          'Authorization',
          `${nonceResponse.body.tokenType} ${nonceResponse.body.accessToken}`,
        )
        .send({
          message,
          signature,
        })
        .expect(401)
        .expect(({ headers, body }) => {
          expect(headers['set-cookie']).toBeUndefined();

          expect(body).toStrictEqual({
            error: 'Unauthorized',
            message: 'Invalid nonce',
            statusCode: 401,
          });
        });
      // Nonce deleted
      await expect(cacheService.hGet(cacheDir)).resolves.toBeNull();
    });

    it('should not verify a signer if the signature is invalid', async () => {
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const expirationTime = faker.date.between({
        from: new Date(),
        to: new Date(Date.now() + maxValidityPeriodInMs),
      });
      const nonce: string = nonceResponse.body.nonce;
      const message = createSiweMessage(
        siweMessageBuilder()
          .with('nonce', nonce)
          .with('expirationTime', expirationTime)
          .build(),
      );
      const cacheDir = new CacheDir(`auth_nonce_${nonce}`, '');
      const signature = faker.string.hexadecimal({ length: 132 });

      await expect(cacheService.hGet(cacheDir)).resolves.toBe(nonce);
      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({
          message,
          signature,
        })
        .expect(401)
        .expect(({ headers, body }) => {
          expect(headers['set-cookie']).toBeUndefined();

          expect(body).toStrictEqual({
            error: 'Unauthorized',
            message: 'Invalid signature',
            statusCode: 401,
          });
        });
      // Nonce deleted
      await expect(cacheService.hGet(cacheDir)).resolves.toBeNull();
    });

    it('should not verify a signer if the message has expired', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const cacheDir = new CacheDir(`auth_nonce_${nonce}`, '');
      // Expired beyond the allowed clock-skew tolerance
      const expirationTime = new Date(Date.now() - 60_000);
      const message = createSiweMessage(
        siweMessageBuilder()
          .with('address', signer.address)
          .with('nonce', nonce)
          .with('expirationTime', expirationTime)
          .build(),
      );
      const signature = await signer.signMessage({
        message,
      });

      await expect(cacheService.hGet(cacheDir)).resolves.toBe(nonce);
      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({
          message,
          signature,
        })
        .expect(401)
        .expect(({ headers, body }) => {
          expect(headers['set-cookie']).toBeUndefined();

          expect(body).toStrictEqual({
            error: 'Unauthorized',
            message: 'Invalid message',
            statusCode: 401,
          });
        });
      // Nonce remains as SiWe message is expired, not the nonce
      await expect(cacheService.hGet(cacheDir)).resolves.toBe(nonce);
    });

    it('should not verify a signer if the message expired within the clock-skew tolerance', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const cacheDir = new CacheDir(`auth_nonce_${nonce}`, '');
      const expirationTime = new Date(Date.now() - clockSkewInMs + 1);
      const message = createSiweMessage(
        siweMessageBuilder()
          .with('address', signer.address)
          .with('nonce', nonce)
          .with('expirationTime', expirationTime)
          .build(),
      );
      const signature = await signer.signMessage({
        message,
      });

      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({
          message,
          signature,
        })
        .expect(401)
        .expect(({ headers, body }) => {
          expect(headers['set-cookie']).toBeUndefined();

          expect(body).toStrictEqual({
            error: 'Unauthorized',
            message: 'Invalid message',
            statusCode: 401,
          });
        });
      // Nonce deleted
      await expect(cacheService.hGet(cacheDir)).resolves.toBeNull();
    });

    describe('minimum token lifetime', () => {
      beforeEach(() => {
        // A sub-second clock makes the floored exp fall short of the minimum by a fraction
        const startOfSecond = Math.floor(Date.now() / 1_000) * 1_000;
        vi.setSystemTime(
          startOfSecond + faker.number.int({ min: 1, max: 999 }),
        );
      });

      function getEarliestAcceptedExpiry(): number {
        const minimumInMs = MIN_TOKEN_LIFETIME_SECONDS * 1_000;
        return Math.ceil((Date.now() + minimumInMs) / 1_000) * 1_000;
      }

      async function verifyWithExpiry(expirationTime: Date) {
        const signer = privateKeyToAccount(generatePrivateKey());
        const nonceResponse = await request(app.getHttpServer()).get(
          '/v1/auth/nonce',
        );
        const message = createSiweMessage(
          siweMessageBuilder()
            .with('address', signer.address)
            .with('nonce', nonceResponse.body.nonce)
            .with('expirationTime', expirationTime)
            .build(),
        );
        const signature = await signer.signMessage({ message });

        return request(app.getHttpServer())
          .post('/v1/auth/verify')
          .send({ message, signature });
      }

      it('should not verify a signer if the expirationTime leaves less than the minimum', async () => {
        const response = await verifyWithExpiry(
          new Date(getEarliestAcceptedExpiry() - 1),
        );

        expect(response.status).toBe(401);
        expect(response.headers['set-cookie']).toBeUndefined();
        expect(response.body).toStrictEqual({
          error: 'Unauthorized',
          message: 'Invalid message',
          statusCode: 401,
        });
      });

      it('should issue a usable access token if the expirationTime leaves the minimum', async () => {
        const response = await verifyWithExpiry(
          new Date(getEarliestAcceptedExpiry()),
        );

        expect(response.status).toBe(200);
        const setCookie = response.headers['set-cookie'];
        expect(setCookie).toHaveLength(1);
        const accessToken = setCookie[0].match(/access_token=([^;]*)/)?.[1];
        expect(() => jwtService.verify(accessToken!)).not.toThrow();
        const maxAge = Number(setCookie[0].match(/Max-Age=(\d+)/)?.[1]);
        expect(maxAge).toBeGreaterThan(0);
      });
    });

    it('should issue an access token that is active immediately if notBefore is within the clock-skew tolerance', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const notBefore = new Date(Date.now() + clockSkewInMs);
      const message = createSiweMessage(
        siweMessageBuilder()
          .with('address', signer.address)
          .with('nonce', nonce)
          .with('notBefore', notBefore)
          .with('expirationTime', undefined)
          .build(),
      );
      const signature = await signer.signMessage({
        message,
      });

      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({
          message,
          signature,
        })
        .expect(200)
        .expect(({ headers }) => {
          const setCookie = headers['set-cookie'];
          expect(setCookie).toHaveLength(1);

          const accessToken = setCookie[0].match(/access_token=([^;]*)/)?.[1];
          expect(accessToken).toBeDefined();
          expect(() => jwtService.verify(accessToken!)).not.toThrow();
        });
    });

    it('should not verify a signer if the expirationTime is not after notBefore', async () => {
      // A wide skew lets notBefore sit far enough ahead that an expiry before it
      // still passes the minimum lifetime, so only the window check rejects it
      const defaultConfiguration = configuration();
      const testConfiguration = (): typeof defaultConfiguration => ({
        ...defaultConfiguration,
        auth: {
          ...defaultConfiguration.auth,
          clockSkewSeconds: faker.number.int({ min: 10, max: 30 }),
          maxValidityPeriodSeconds: faker.number.int({
            min: 60,
            max: 60 * 1_000,
          }),
        },
        features: {
          ...defaultConfiguration.features,
          auth: true,
        },
      });
      await initApp(testConfiguration);

      const signer = privateKeyToAccount(generatePrivateKey());
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const notBefore = new Date(Date.now() + clockSkewInMs);
      const expirationTime = new Date(
        notBefore.getTime() - faker.number.int({ min: 0, max: 5_000 }),
      );
      const message = createSiweMessage(
        siweMessageBuilder()
          .with('address', signer.address)
          .with('nonce', nonceResponse.body.nonce)
          .with('notBefore', notBefore)
          .with('expirationTime', expirationTime)
          .build(),
      );
      const signature = await signer.signMessage({ message });

      const response = await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({ message, signature });

      expect(response.status).toBe(401);
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(response.body).toStrictEqual({
        error: 'Unauthorized',
        message: 'Invalid message',
        statusCode: 401,
      });
    });

    it('should get the max expirationTime if not specified on the SiWE message', async () => {
      // Fix "now" as it is otherwise to precisely expect expiration/maxAge
      vi.setSystemTime(0);

      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const cacheDir = new CacheDir(`auth_nonce_${nonce}`, '');
      const message = createSiweMessage(
        siweMessageBuilder()
          .with('address', signer.address)
          .with('nonce', nonce)
          .with('expirationTime', undefined)
          .build(),
      );
      const signature = await signer.signMessage({
        message,
      });
      const expectedExpirationTime = new Date(
        Date.now() + maxValidityPeriodInMs,
      );
      const maxAge = getSecondsUntil(expectedExpirationTime);

      await expect(cacheService.hGet(cacheDir)).resolves.toBe(
        nonceResponse.body.nonce,
      );
      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({
          message,
          signature,
        })
        .expect(200)
        .expect(({ headers }) => {
          const setCookie = headers['set-cookie'];
          const setCookieRegExp = new RegExp(
            `access_token=([^;]*); Max-Age=${maxAge}; Path=/; Expires=${expectedExpirationTime.toUTCString()}; HttpOnly; Secure; SameSite=Lax`,
          );

          expect(setCookie).toHaveLength(1);
          expect(setCookie[0]).toMatch(setCookieRegExp);
        });
      // Nonce deleted
      await expect(cacheService.hGet(cacheDir)).resolves.toBeNull();
    });
  });

  describe('POST /v1/auth/logout', () => {
    it('should log a signer out', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const expirationTime = getAcceptedExpirationTime();
      const message = createSiweMessage(
        siweMessageBuilder()
          .with('address', signer.address)
          .with('nonce', nonce)
          .with('expirationTime', expirationTime)
          .build(),
      );
      const signature = await signer.signMessage({
        message,
      });

      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({
          message,
          signature,
        })
        .expect(200);
      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .expect(200)
        .expect(({ headers }) => {
          const setCookie = headers['set-cookie'].toString();
          // access_token has no value and it is set to expire
          expect(setCookie).toBe(
            'access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax',
          );
        });
    });
  });

  describe('POST /v1/auth/logout/redirect', () => {
    it('should redirect OIDC user through Auth0 logout', async () => {
      const authPayloadDto = oidcAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/auth/logout/redirect')
        .send({})
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(303)
        .expect(({ headers }) => {
          expect(headers.location).toMatch(
            /^https:\/\/.*\/v2\/logout\?client_id=.*&returnTo=/,
          );
          const setCookie = headers['set-cookie'].toString();
          expect(setCookie).toContain('access_token=;');
          expect(setCookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
        });
    });

    it('should redirect SiWe user directly to postLoginRedirectUri', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      const configService: IConfigurationService = app.get(
        IConfigurationService,
      );
      const postLoginRedirectUri = configService.getOrThrow<string>(
        'auth.postLoginRedirectUri',
      );

      await request(app.getHttpServer())
        .post('/v1/auth/logout/redirect')
        .send({})
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(303)
        .expect(({ headers }) => {
          expect(headers.location).toBe(postLoginRedirectUri);
          const setCookie = headers['set-cookie'].toString();
          expect(setCookie).toContain('access_token=;');
        });
    });

    it('should redirect to postLoginRedirectUri when no token present', async () => {
      const configService: IConfigurationService = app.get(
        IConfigurationService,
      );
      const postLoginRedirectUri = configService.getOrThrow<string>(
        'auth.postLoginRedirectUri',
      );

      await request(app.getHttpServer())
        .post('/v1/auth/logout/redirect')
        .send({})
        .expect(303)
        .expect(({ headers }) => {
          expect(headers.location).toBe(postLoginRedirectUri);
          const setCookie = headers['set-cookie'].toString();
          expect(setCookie).toContain('access_token=;');
        });
    });

    it('should include redirect_url in the redirect location', async () => {
      const configService: IConfigurationService = app.get(
        IConfigurationService,
      );
      const postLoginRedirectUri = configService.getOrThrow<string>(
        'auth.postLoginRedirectUri',
      );
      const redirectUrl = `${postLoginRedirectUri}/settings`;

      await request(app.getHttpServer())
        .post('/v1/auth/logout/redirect')
        .send({ redirect_url: redirectUrl })
        .expect(303)
        .expect(({ headers }) => {
          expect(headers.location).toBe(redirectUrl);
        });
    });

    it('should redirect expired OIDC token through Auth0 logout', async () => {
      const authPayloadDto = oidcAuthPayloadDtoBuilder().build();
      // Sign with an already-expired expiration
      const accessToken = jwtService.sign({
        ...authPayloadDto,
        exp: new Date(Date.now() - 60_000),
      });

      await request(app.getHttpServer())
        .post('/v1/auth/logout/redirect')
        .send({})
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(303)
        .expect(({ headers }) => {
          expect(headers.location).toMatch(
            /^https:\/\/.*\/v2\/logout\?client_id=.*&returnTo=/,
          );
          const setCookie = headers['set-cookie'].toString();
          expect(setCookie).toContain('access_token=;');
        });
    });

    it('should accept redirect_url from application/x-www-form-urlencoded body', async () => {
      const configService: IConfigurationService = app.get(
        IConfigurationService,
      );
      const postLoginRedirectUri = configService.getOrThrow<string>(
        'auth.postLoginRedirectUri',
      );
      const redirectUrl = `${postLoginRedirectUri}/settings`;

      await request(app.getHttpServer())
        .post('/v1/auth/logout/redirect')
        .type('form')
        .send(`redirect_url=${encodeURIComponent(redirectUrl)}`)
        .expect(303)
        .expect(({ headers }) => {
          expect(headers.location).toBe(redirectUrl);
        });
    });

    it('should return 400 for cross-origin redirect_url', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/logout/redirect')
        .send({ redirect_url: 'https://evil.com' })
        .expect(400);
    });
  });

  describe('GET /v1/auth/me', () => {
    it('should return 200 with id, authMethod and signerAddress for a valid Siwe access token', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            id: authPayloadDto.sub,
            authMethod: 'siwe',
            signerAddress: authPayloadDto.signer_address,
          });
        });
    });

    it('should return 200 with id and authMethod (no signerAddress) for a valid OIDC access token', async () => {
      const authPayloadDto = oidcAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            id: authPayloadDto.sub,
            authMethod: 'oidc',
          });
          expect(body).not.toHaveProperty('signerAddress');
        });
    });

    it('should omit email for a valid OIDC access token when no email is stored', async () => {
      const authPayloadDto = oidcAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      usersRepository.findEmailById.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            id: authPayloadDto.sub,
            authMethod: 'oidc',
          });
          expect(body).not.toHaveProperty('email');
        });
    });

    it('should return 200 with email for a valid OIDC access token when stored', async () => {
      const authPayloadDto = oidcAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const email = fakeEmailAddress();
      usersRepository.findEmailById.mockResolvedValue(email);

      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            id: authPayloadDto.sub,
            authMethod: 'oidc',
            email,
          });
        });
    });

    it('should return 403 without an access token', async () => {
      await request(app.getHttpServer()).get('/v1/auth/me').expect(403);
    });

    it('should return 403 with an invalid access token', async () => {
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Cookie', ['access_token=invalid-token'])
        .expect(403);
    });
  });
});
