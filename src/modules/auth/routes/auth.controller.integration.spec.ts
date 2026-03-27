// SPDX-License-Identifier: FSL-1.1-MIT
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import configuration from '@/config/entities/__tests__/configuration';
import { EmailModule } from '@/modules/email/email.module';
import { TestEmailApiModule } from '@/modules/email/datasources/__tests__/test.email-api.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import {
  oidcAuthPayloadDtoBuilder,
  siweAuthPayloadDtoBuilder,
} from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { siweMessageBuilder } from '@/modules/siwe/domain/entities/__tests__/siwe-message.builder';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { faker } from '@faker-js/faker';
import { createSiweMessage } from 'viem/siwe';
import { CacheService } from '@/datasources/cache/cache.service.interface';
import type { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { getSecondsUntil } from '@/domain/common/utils/time';
import type { Server } from 'net';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { UsersModule } from '@/modules/users/users.module';
import { TestUsersModule } from '@/modules/users/__tests__/test.users.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import type { TestingModule } from '@nestjs/testing';

describe('AuthController', () => {
  let app: INestApplication<Server>;
  let cacheService: FakeCacheService;
  let jwtService: IJwtService;

  let maxValidityPeriodInMs: number;

  async function initApp(config: typeof configuration): Promise<void> {
    await app?.close();
    const moduleFixture: TestingModule = await createTestModule({
      config,
      modules: [
        {
          originalModule: EmailModule,
          testModule: TestEmailApiModule,
        },
        {
          originalModule: UsersModule,
          testModule: TestUsersModule,
        },
      ],
    });

    cacheService = moduleFixture.get(CacheService);
    jwtService = moduleFixture.get(IJwtService);

    const configService: IConfigurationService = moduleFixture.get(
      IConfigurationService,
    );

    maxValidityPeriodInMs =
      configService.getOrThrow<number>('auth.maxValidityPeriodSeconds') * 1_000;

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  }

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.resetAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      application: {
        ...defaultConfiguration.application,
        isProduction: true,
      },
      features: {
        ...defaultConfiguration.features,
        auth: true,
      },
    });

    await initApp(testConfiguration);
  });

  afterEach(async () => {
    jest.useRealTimers();
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
      jest.setSystemTime(0);

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
      jest.setSystemTime(0);

      const defaultConfiguration = configuration();
      const testConfiguration = (): typeof defaultConfiguration => ({
        ...defaultConfiguration,
        application: {
          ...defaultConfiguration.application,
          isProduction: false,
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
      const expirationTime = new Date();
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

    it('should get the max expirationTime if not specified on the SiWE message', async () => {
      // Fix "now" as it is otherwise to precisely expect expiration/maxAge
      jest.setSystemTime(0);

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

  describe('GET /v1/auth/logout', () => {
    it('should redirect OIDC user through Auth0 logout', async () => {
      const authPayloadDto = oidcAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get('/v1/auth/logout')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(302)
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
        .get('/v1/auth/logout')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(302)
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
        .get('/v1/auth/logout')
        .expect(302)
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
        .get(`/v1/auth/logout?redirect_url=${encodeURIComponent(redirectUrl)}`)
        .expect(302)
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
        .get('/v1/auth/logout')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(302)
        .expect(({ headers }) => {
          expect(headers.location).toMatch(
            /^https:\/\/.*\/v2\/logout\?client_id=.*&returnTo=/,
          );
          const setCookie = headers['set-cookie'].toString();
          expect(setCookie).toContain('access_token=;');
        });
    });

    it('should return 400 for cross-origin redirect_url', async () => {
      await request(app.getHttpServer())
        .get(
          `/v1/auth/logout?redirect_url=${encodeURIComponent('https://evil.com')}`,
        )
        .expect(400);
    });
  });

  describe('GET /v1/auth/me', () => {
    it('should return 200 with user id for a valid Siwe access token', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({ id: authPayloadDto.sub });
        });
    });

    it('should return 200 with user id for a valid OIDC access token', async () => {
      const authPayloadDto = oidcAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({ id: authPayloadDto.sub });
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
