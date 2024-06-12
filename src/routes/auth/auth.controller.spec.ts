import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
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
import { createSiweMessage } from 'viem/siwe';
import { CacheService } from '@/datasources/cache/cache.service.interface';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { getSecondsUntil } from '@/domain/common/utils/time';
import {
  JWT_CONFIGURATION_MODULE,
  JwtConfigurationModule,
} from '@/datasources/jwt/configuration/jwt.configuration.module';
import jwtConfiguration from '@/datasources/jwt/configuration/__tests__/jwt.configuration';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { Server } from 'net';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { FakeBlockchainApiManager } from '@/datasources/blockchain/__tests__/fake.blockchain-api.manager';
import {
  BlockchainApiManagerModule,
  IBlockchainApiManager,
} from '@/domain/interfaces/blockchain-api.manager.interface';
import { TestBlockchainApiManagerModule } from '@/datasources/blockchain/__tests__/test.blockchain-api.manager';

const verifySiweMessageMock = jest.fn();

describe('AuthController', () => {
  let app: INestApplication<Server>;
  let cacheService: FakeCacheService;
  let blockchainApiManager: FakeBlockchainApiManager;
  let maxValidityPeriodInMs: number;

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
      .overrideModule(BlockchainApiManagerModule)
      .useModule(TestBlockchainApiManagerModule)
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
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .compile();

    cacheService = moduleFixture.get(CacheService);
    blockchainApiManager = moduleFixture.get(IBlockchainApiManager);
    const configService: IConfigurationService = moduleFixture.get(
      IConfigurationService,
    );
    maxValidityPeriodInMs =
      configService.getOrThrow<number>('auth.maxValidityPeriodSeconds') * 1_000;

    blockchainApiManager.getBlockchainApi.mockImplementation(() => ({
      verifySiweMessage: verifySiweMessageMock,
    }));

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
      // Verified off-chain as EOA
      expect(verifySiweMessageMock).not.toHaveBeenCalled();
      // Nonce deleted
      await expect(cacheService.get(cacheDir)).resolves.toBe(undefined);
    });

    it('should verify a smart contract signer', async () => {
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
          .with('nonce', nonce)
          .with('expirationTime', expirationTime)
          .build(),
      );
      const signature = faker.string.hexadecimal({ length: 132 });
      verifySiweMessageMock.mockResolvedValue(true);
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
      // Verified on-chain as could not verify EOA
      expect(verifySiweMessageMock).toHaveBeenCalledTimes(1);
      // Nonce deleted
      await expect(cacheService.get(cacheDir)).resolves.toBe(undefined);
    });

    it('should not verify a signer if expirationTime is too high', async () => {
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

      await expect(cacheService.get(cacheDir)).resolves.toBe(nonce);
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

    it('should not verify a (smart contract) signer if the signature is invalid', async () => {
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
      verifySiweMessageMock.mockResolvedValue(false);

      await expect(cacheService.get(cacheDir)).resolves.toBe(nonce);
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
      // Tried to verify off-/on-chain but failed
      expect(verifySiweMessageMock).toHaveBeenCalledTimes(1);
      // Nonce deleted
      await expect(cacheService.get(cacheDir)).resolves.toBe(undefined);
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

      await expect(cacheService.get(cacheDir)).resolves.toBe(nonce);
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
