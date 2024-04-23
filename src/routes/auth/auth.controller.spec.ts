import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import { EmailApiModule } from '@/datasources/email-api/email-api.module';
import { TestEmailApiModule } from '@/datasources/email-api/__tests__/test.email-api.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { siweMessageBuilder } from '@/domain/siwe/entities/__tests__/siwe-message.builder';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { faker } from '@faker-js/faker';
import { toSignableSiweMessage } from '@/datasources/siwe-api/utils/to-signable-siwe-message';
import { CacheService } from '@/datasources/cache/cache.service.interface';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { getSecondsUntil } from '@/domain/common/utils/time';
import {
  JWT_CONFIGURATION_MODULE,
  JwtConfigurationModule,
} from '@/datasources/jwt/configuration/jwt.configuration.module';
import jwtConfiguration from '@/datasources/jwt/configuration/__tests__/jwt.configuration';

const MAX_VALIDITY_PERIOD_IN_MS = 15 * 60 * 1_000; // 15 minutes

describe('AuthController', () => {
  let app: INestApplication;
  let cacheService: FakeCacheService;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.resetAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        auth: true,
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(testConfiguration)],
    })
      .overrideModule(JWT_CONFIGURATION_MODULE)
      .useModule(JwtConfigurationModule.register(jwtConfiguration))
      .overrideModule(AccountDataSourceModule)
      .useModule(TestAccountDataSourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideModule(EmailApiModule)
      .useModule(TestEmailApiModule)
      .compile();

    cacheService = moduleFixture.get(CacheService);

    app = await new TestAppProvider().provide(moduleFixture);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.useRealTimers();
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
          await expect(cacheService.get(cacheDir)).resolves.toBe(body.nonce);
        });
    });
  });

  describe('POST /v1/auth/verify', () => {
    it('should verify a signer', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const cacheDir = new CacheDir(
        `auth_nonce_${nonceResponse.body.nonce}`,
        '',
      );
      const expirationTime = faker.date.between({
        from: new Date(),
        to: new Date(Date.now() + MAX_VALIDITY_PERIOD_IN_MS),
      });
      const message = siweMessageBuilder()
        .with('address', signer.address)
        .with('nonce', nonceResponse.body.nonce)
        .with('expirationTime', expirationTime.toISOString())
        .build();
      const signature = await signer.signMessage({
        message: toSignableSiweMessage(message),
      });
      const maxAge = getSecondsUntil(expirationTime);
      // jsonwebtoken sets expiration based on timespans, not exact dates
      // meaning we cannot use expirationTime directly
      const expires = new Date(Date.now() + maxAge * 1_000);

      await expect(cacheService.get(cacheDir)).resolves.toBe(
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
            `access_token=([^;]*); Max-Age=${maxAge}; Path=/; Expires=${expires.toUTCString()}; HttpOnly; Secure; SameSite=Lax`,
          );

          expect(setCookie).toHaveLength;
          expect(setCookie[0]).toMatch(setCookieRegExp);
        });
      // Nonce deleted
      await expect(cacheService.get(cacheDir)).resolves.toBe(undefined);
    });

    it('should not verify a signer if expirationTime is too high', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const cacheDir = new CacheDir(
        `auth_nonce_${nonceResponse.body.nonce}`,
        '',
      );
      const expirationTime = faker.date.future({
        refDate: new Date(Date.now() + MAX_VALIDITY_PERIOD_IN_MS),
      });
      const message = siweMessageBuilder()
        .with('address', signer.address)
        .with('nonce', nonceResponse.body.nonce)
        .with('expirationTime', expirationTime.toISOString())
        .build();
      const signature = await signer.signMessage({
        message: toSignableSiweMessage(message),
      });

      await expect(cacheService.get(cacheDir)).resolves.toBe(
        nonceResponse.body.nonce,
      );
      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({
          message,
          signature,
        })
        .expect(422)
        .expect(({ headers, body }) => {
          expect(headers['set-cookie']).toBe(undefined);

          expect(body).toStrictEqual({
            code: 'custom',
            message: 'Must be within 900 seconds',
            path: ['message', 'expirationTime'],
            statusCode: 422,
          });
        });
      // Nonce not deleted
      await expect(cacheService.get(cacheDir)).resolves.toBe(
        nonceResponse.body.nonce,
      );
    });

    it('should not verify a signer if using an unsigned nonce', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const expirationTime = faker.date.between({
        from: new Date(),
        to: new Date(Date.now() + MAX_VALIDITY_PERIOD_IN_MS),
      });
      const message = siweMessageBuilder()
        .with('address', signer.address)
        .with('expirationTime', expirationTime.toISOString())
        .build();
      const cacheDir = new CacheDir(`auth_nonce_${message.nonce}`, '');
      const signature = await signer.signMessage({
        message: toSignableSiweMessage(message),
      });

      await expect(cacheService.get(cacheDir)).resolves.toBe(undefined);
      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({
          message,
          signature,
        })
        .expect(401)
        .expect(({ headers, body }) => {
          expect(headers['set-cookie']).toBe(undefined);

          expect(body).toStrictEqual({
            message: 'Unauthorized',
            statusCode: 401,
          });
        });
      // Nonce deleted
      await expect(cacheService.get(cacheDir)).resolves.toBe(undefined);
    });

    it('should not verify a signer if the nonce has expired', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const cacheDir = new CacheDir(
        `auth_nonce_${nonceResponse.body.nonce}`,
        '',
      );
      const expirationTime = faker.date.between({
        from: new Date(),
        to: new Date(Date.now() + MAX_VALIDITY_PERIOD_IN_MS),
      });
      const message = siweMessageBuilder()
        .with('address', signer.address)
        .with('nonce', nonceResponse.body.nonce)
        .with('expirationTime', expirationTime.toISOString())
        .build();
      const signature = await signer.signMessage({
        message: toSignableSiweMessage(message),
      });
      // Mimic ttl expiration
      await cacheService.deleteByKey(cacheDir.key);

      await expect(cacheService.get(cacheDir)).resolves.toBe(undefined);
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
          expect(headers['set-cookie']).toBe(undefined);

          expect(body).toStrictEqual({
            message: 'Unauthorized',
            statusCode: 401,
          });
        });
      // Nonce deleted
      await expect(cacheService.get(cacheDir)).resolves.toBe(undefined);
    });

    it('should not verify a signer if the signature is invalid', async () => {
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const expirationTime = faker.date.between({
        from: new Date(),
        to: new Date(Date.now() + MAX_VALIDITY_PERIOD_IN_MS),
      });
      const message = siweMessageBuilder()
        .with('nonce', nonceResponse.body.nonce)
        .with('expirationTime', expirationTime.toISOString())
        .build();
      const cacheDir = new CacheDir(
        `auth_nonce_${nonceResponse.body.nonce}`,
        '',
      );
      const signature = faker.string.hexadecimal();

      await expect(cacheService.get(cacheDir)).resolves.toBe(
        nonceResponse.body.nonce,
      );
      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({
          message,
          signature,
        })
        .expect(401)
        .expect(({ headers, body }) => {
          expect(headers['set-cookie']).toBe(undefined);

          expect(body).toStrictEqual({
            message: 'Unauthorized',
            statusCode: 401,
          });
        });
      // Nonce deleted
      await expect(cacheService.get(cacheDir)).resolves.toBe(undefined);
    });

    it('should not verify a signer if the message has expired', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const cacheDir = new CacheDir(
        `auth_nonce_${nonceResponse.body.nonce}`,
        '',
      );
      const expirationTime = faker.date.past();
      const message = siweMessageBuilder()
        .with('address', signer.address)
        .with('nonce', nonceResponse.body.nonce)
        .with('expirationTime', expirationTime.toISOString())
        .build();
      const signature = await signer.signMessage({
        message: toSignableSiweMessage(message),
      });

      await expect(cacheService.get(cacheDir)).resolves.toBe(
        nonceResponse.body.nonce,
      );
      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({
          message,
          signature,
        })
        .expect(401)
        .expect(({ headers, body }) => {
          expect(headers['set-cookie']).toBe(undefined);

          expect(body).toStrictEqual({
            message: 'Unauthorized',
            statusCode: 401,
          });
        });
      // Nonce deleted
      await expect(cacheService.get(cacheDir)).resolves.toBe(undefined);
    });
  });
});
