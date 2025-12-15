import { type Address, getAddress } from 'viem';
import { faker } from '@faker-js/faker';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import configuration from '@/config/entities/__tests__/configuration';
import { TestAccountsDataSourceModule } from '@/modules/accounts/datasources/__tests__/test.accounts.datasource.module';
import { AccountsDatasourceModule } from '@/modules/accounts/datasources/accounts.datasource.module';
import { TestAddressBooksDataSourceModule } from '@/modules/accounts/datasources/address-books/__tests__/test.address-books.datasource.module';
import { AddressBooksDatasourceModule } from '@/modules/accounts/datasources/address-books/address-books.datasource.module';
import { TestCounterfactualSafesDataSourceModule } from '@/modules/accounts/datasources/counterfactual-safes/__tests__/test.counterfactual-safes.datasource.module';
import { CounterfactualSafesDatasourceModule } from '@/modules/accounts/datasources/counterfactual-safes/counterfactual-safes.datasource.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/test.notification.repository.module';
import { authPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { UsersController } from '@/modules/users/routes/users.controller';
import { checkGuardIsApplied } from '@/__tests__/util/check-guard';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'net';
import { getEnumKey } from '@/domain/common/utils/enum';
import { UserStatus } from '@/modules/users/domain/entities/user.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheService } from '@/datasources/cache/cache.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createSiweMessage, generateSiweNonce } from 'viem/siwe';
import { siweMessageBuilder } from '@/modules/siwe/domain/entities/__tests__/siwe-message.builder';
import type { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';

describe('UsersController', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let cacheService: FakeCacheService;
  let maxValidityPeriodInMs: number;

  beforeEach(async () => {
    jest.resetAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        auth: true,
        users: true,
      },
    });

    const moduleFixture = await createTestModule({
      config: testConfiguration,
      overridePostgresV2: false,
      modules: [
        {
          originalModule: AccountsDatasourceModule,
          testModule: TestAccountsDataSourceModule,
        },
        {
          originalModule: AddressBooksDatasourceModule,
          testModule: TestAddressBooksDataSourceModule,
        },
        {
          originalModule: CounterfactualSafesDatasourceModule,
          testModule: TestCounterfactualSafesDataSourceModule,
        },
        {
          originalModule: NotificationsRepositoryV2Module,
          testModule: TestNotificationsRepositoryV2Module,
        },
      ],
    });

    jwtService = moduleFixture.get<IJwtService>(IJwtService);
    cacheService = moduleFixture.get(CacheService);
    const configService: IConfigurationService = moduleFixture.get(
      IConfigurationService,
    );
    maxValidityPeriodInMs =
      configService.getOrThrow<number>('auth.maxValidityPeriodSeconds') * 1_000;

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should require authentication for every endpoint', () => {
    const endpoints = Object.values(
      UsersController.prototype,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    ) as Array<Function>;

    endpoints.forEach((fn) => checkGuardIsApplied(AuthGuard, fn));
  });

  describe('GET /v1/users', () => {
    it('should return the user with wallets', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .get('/v1/users')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) =>
          expect(body).toEqual({
            id: expect.any(Number),
            status: getEnumKey(UserStatus, UserStatus.ACTIVE),
            wallets: [
              {
                id: expect.any(Number),
                address: authPayloadDto.signer_address,
              },
            ],
          }),
        );
    });

    // Note: we could extensively test JWT validity but it is covered in the AuthGuard tests
    it('should return a 403 if not authenticated', async () => {
      await request(app.getHttpServer()).get('/v1/users').expect(403).expect({
        statusCode: 403,
        message: 'Forbidden resource',
        error: 'Forbidden',
      });
    });

    it('should return a 403 is the AuthPayload is empty', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as Address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get('/v1/users')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('should return a 404 if the wallet is not found', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get('/v1/users')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404)
        .expect({
          statusCode: 404,
          message: 'Wallet not found. Address=' + authPayloadDto.signer_address,
          error: 'Not Found',
        });
    });
  });

  describe('DELETE /v1/users', () => {
    // TODO: Check wallet/user entities are removed in integration test (and other tests don't)
    it('should delete the user', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .delete('/v1/users')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({});
    });

    // Note: we could extensively test JWT validity but it is covered in the AuthGuard tests
    it('should return a 403 if not authenticated', async () => {
      await request(app.getHttpServer())
        .delete('/v1/users')
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('should return a 403 is the AuthPayload is empty', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as Address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .delete('/v1/users')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('should return a 404 if the user is not found', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .delete('/v1/users')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404)
        .expect({
          statusCode: 404,
          message: 'Wallet not found. Address=' + authPayloadDto.signer_address,
          error: 'Not Found',
        });
    });
  });

  describe('POST /v1/users/wallet', () => {
    it('should create a user with a wallet', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201)
        .expect(({ body }) =>
          expect(body).toEqual({
            id: expect.any(Number),
          }),
        );
    });

    // Note: we could extensively test JWT validity but it is covered in the AuthGuard tests
    it('should return a 403 if not authenticated', async () => {
      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('should return a 403 is the AuthPayload is empty', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as Address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('should return a 409 if the wallet already exists', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(409)
        .expect({
          statusCode: 409,
          message:
            'A wallet with the same address already exists. Wallet=' +
            authPayloadDto.signer_address,
          error: 'Conflict',
        });
    });
  });

  describe('POST /v1/users/wallet/add', () => {
    it('should add a wallet to a user and clear the nonce', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const cacheDir = new CacheDir(`auth_nonce_${nonce}`, '');
      const expirationTime = new Date(Date.now() + maxValidityPeriodInMs);
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

      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/users/wallet/add')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          message,
          signature,
        })
        .expect(201)
        .expect(({ body }) =>
          expect(body).toEqual({
            id: expect.any(Number),
          }),
        );
      await expect(cacheService.hGet(cacheDir)).resolves.toBeUndefined();
    });

    it('should return a 403 if not authenticated', async () => {
      await request(app.getHttpServer())
        .post('/v1/users/wallet/add')
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('should return a 403 is the AuthPayload is empty', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as Address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet/add')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('should return a 422 if payload is invalid and not clear the nonce', async () => {
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const cacheDir = new CacheDir(`auth_nonce_${nonce}`, '');

      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/users/wallet/add')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({})
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['message'],
          message: 'Required',
        });
      await expect(cacheService.hGet(cacheDir)).resolves.toBe(nonce);
    });

    it('should return a 401 if message is missing an issued-at and not clear the nonce', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const cacheDir = new CacheDir(`auth_nonce_${nonce}`, '');
      const expirationTime = new Date(Date.now() + maxValidityPeriodInMs);
      const messageObj = siweMessageBuilder()
        .with('address', signer.address)
        .with('nonce', nonce)
        .with('issuedAt', undefined)
        .with('expirationTime', expirationTime)
        .build();
      // We cannot use createSiweMessage here because it assigns a default issuedAt value
      const message = `${messageObj.scheme}://${messageObj.domain} wants you to sign in with your Ethereum account:
${messageObj.address}

${messageObj.statement}

URI: ${messageObj.uri}
Version: ${messageObj.version}
Chain ID: ${messageObj.chainId}
Nonce: ${messageObj.nonce}
Issued At: ${messageObj.issuedAt?.toISOString()}
Expiration Time: ${messageObj.expirationTime?.toISOString()}
Not Before: ${messageObj.notBefore?.toISOString()}
Request ID: ${messageObj.requestId}
${messageObj.resources?.reduce((acc, cur) => `${acc}\n- ${cur}`, 'Resources:')}`;
      const signature = await signer.signMessage({
        message,
      });

      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/users/wallet/add')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          message,
          signature,
        })
        .expect(401)
        .expect({
          statusCode: 401,
          message: 'Invalid message',
          error: 'Unauthorized',
        });
      await expect(cacheService.hGet(cacheDir)).resolves.toBe(nonce);
    });

    it('should return a 401 if message is yet issued and not clear the nonce', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const cacheDir = new CacheDir(`auth_nonce_${nonce}`, '');
      const issuedAt = faker.date.future();
      const expirationTime = new Date(
        issuedAt.getTime() + maxValidityPeriodInMs,
      );
      const message = createSiweMessage(
        siweMessageBuilder()
          .with('address', signer.address)
          .with('nonce', nonce)
          .with('issuedAt', issuedAt)
          .with('expirationTime', expirationTime)
          .build(),
      );
      const signature = await signer.signMessage({
        message,
      });

      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/users/wallet/add')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          message,
          signature,
        })
        .expect(401)
        .expect({
          statusCode: 401,
          message: 'Invalid message',
          error: 'Unauthorized',
        });
      await expect(cacheService.hGet(cacheDir)).resolves.toBe(nonce);
    });

    it('should return a 401 if message has expired and not clear the nonce', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const cacheDir = new CacheDir(`auth_nonce_${nonce}`, '');
      const issuedAt = new Date();
      const expirationTime = faker.date.past();
      const message = createSiweMessage(
        siweMessageBuilder()
          .with('address', signer.address)
          .with('nonce', nonce)
          .with('issuedAt', issuedAt)
          .with('expirationTime', expirationTime)
          .build(),
      );
      const signature = await signer.signMessage({
        message,
      });

      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/users/wallet/add')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          message,
          signature,
        })
        .expect(401)
        .expect({
          statusCode: 401,
          message: 'Invalid message',
          error: 'Unauthorized',
        });
      await expect(cacheService.hGet(cacheDir)).resolves.toBe(nonce);
    });

    it('should return a 401 if message is not yet valid and not clear the nonce', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const cacheDir = new CacheDir(`auth_nonce_${nonce}`, '');
      const issuedAt = new Date();
      const notBefore = faker.date.future();
      const expirationTime = new Date(
        faker.date.future().getTime() + maxValidityPeriodInMs,
      );
      const message = createSiweMessage(
        siweMessageBuilder()
          .with('address', signer.address)
          .with('nonce', nonce)
          .with('issuedAt', issuedAt)
          .with('expirationTime', expirationTime)
          .with('notBefore', notBefore)
          .build(),
      );
      const signature = await signer.signMessage({
        message,
      });

      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/users/wallet/add')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          message,
          signature,
        })
        .expect(401)
        .expect({
          statusCode: 401,
          message: 'Invalid message',
          error: 'Unauthorized',
        });
      await expect(cacheService.hGet(cacheDir)).resolves.toBe(nonce);
    });

    it('should return a 401 if message is invalid and not clear the nonce', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const cacheDir = new CacheDir(`auth_nonce_${nonce}`, '');
      const message = faker.string.hexadecimal();
      const signature = await signer.signMessage({
        message,
      });

      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/users/wallet/add')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          message,
          signature,
        })
        .expect(401)
        .expect({
          statusCode: 401,
          message: 'Invalid message',
          error: 'Unauthorized',
        });
      await expect(cacheService.hGet(cacheDir)).resolves.toBe(nonce);
    });

    it('should return a 401 if nonce is not cached', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonce = generateSiweNonce();
      const expirationTime = new Date(Date.now() + maxValidityPeriodInMs);
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

      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/users/wallet/add')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          message,
          signature,
        })
        .expect(401)
        .expect({
          statusCode: 401,
          message: 'Invalid nonce',
          error: 'Unauthorized',
        });
    });

    it('should return a 401 if the signature is invalid and clear the nonce', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const cacheDir = new CacheDir(`auth_nonce_${nonce}`, '');
      const expirationTime = new Date(Date.now() + maxValidityPeriodInMs);
      const message = createSiweMessage(
        siweMessageBuilder()
          .with('address', signer.address)
          .with('nonce', nonce)
          .with('expirationTime', expirationTime)
          .build(),
      );
      const signature = await signer.signMessage({
        message: faker.lorem.sentence(),
      });

      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/users/wallet/add')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          message,
          signature,
        })
        .expect(401)
        .expect({
          statusCode: 401,
          message: 'Invalid signature',
          error: 'Unauthorized',
        });
      await expect(cacheService.hGet(cacheDir)).resolves.toBeUndefined();
    });

    it('should return a 409 if the wallet already exists', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse1 = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce1: string = nonceResponse1.body.nonce;
      const expirationTime = new Date(Date.now() + maxValidityPeriodInMs);
      const message1 = createSiweMessage(
        siweMessageBuilder()
          .with('address', signer.address)
          .with('nonce', nonce1)
          .with('expirationTime', expirationTime)
          .build(),
      );
      const signature1 = await signer.signMessage({
        message: message1,
      });
      const nonceResponse2 = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce2: string = nonceResponse2.body.nonce;
      const message2 = createSiweMessage(
        siweMessageBuilder()
          .with('address', signer.address)
          .with('nonce', nonce2)
          .with('expirationTime', expirationTime)
          .build(),
      );
      const signature2 = await signer.signMessage({
        message: message2,
      });

      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/users/wallet/add')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          message: message1,
          signature: signature1,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/users/wallet/add')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          message: message2,
          signature: signature2,
        })
        .expect(409)
        .expect({
          statusCode: 409,
          message:
            'A wallet with the same address already exists. Wallet=' +
            signer.address,
          error: 'Conflict',
        });
    });

    it('should return a 404 if the user does not exist', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const expirationTime = new Date(Date.now() + maxValidityPeriodInMs);
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

      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet/add')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          message,
          signature,
        })
        .expect(404)
        .expect({
          statusCode: 404,
          message: 'User not found.',
          error: 'Not Found',
        });
    });
  });

  describe('DELETE /v1/users/wallet/:walletAddress', () => {
    // TODO: Check wallet was deleted in integration test (and other tests don't)
    it('should delete a wallet from a user', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const expirationTime = new Date(Date.now() + maxValidityPeriodInMs);
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
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', walletAddress)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/users/wallet/add')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          message,
          signature,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/users/wallet/${signer.address}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({});
    });

    // Note: we could extensively test JWT validity but it is covered in the AuthGuard tests
    it('should return a 403 if not authenticated', async () => {
      const walletAddress = getAddress(faker.finance.ethereumAddress());

      await request(app.getHttpServer())
        .delete(`/v1/users/wallet/${walletAddress}`)
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('should return a 403 is the AuthPayload is empty', async () => {
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as Address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .delete(`/v1/users/wallet/${walletAddress}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('should return a 409 if it is the authenticated one', async () => {
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', walletAddress)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/users/wallet/${walletAddress}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(409)
        .expect({
          statusCode: 409,
          message: 'Cannot remove the current wallet',
          error: 'Conflict',
        });
    });

    it('should return a 404 if the user is not found', async () => {
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .delete(`/v1/users/wallet/${walletAddress}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404)
        .expect({
          statusCode: 404,
          message: 'User not found.',
          error: 'Not Found',
        });
    });
  });
});
