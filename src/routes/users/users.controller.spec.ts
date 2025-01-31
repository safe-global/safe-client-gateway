import { getAddress } from 'viem';
import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AppModule } from '@/app.module';
import configuration from '@/config/entities/__tests__/configuration';
import { TestAccountsDataSourceModule } from '@/datasources/accounts/__tests__/test.accounts.datasource.module';
import { AccountsDatasourceModule } from '@/datasources/accounts/accounts.datasource.module';
import { TestAddressBooksDataSourceModule } from '@/datasources/accounts/address-books/__tests__/test.address-books.datasource.module';
import { AddressBooksDatasourceModule } from '@/datasources/accounts/address-books/address-books.datasource.module';
import { TestCounterfactualSafesDataSourceModule } from '@/datasources/accounts/counterfactual-safes/__tests__/test.counterfactual-safes.datasource.module';
import { CounterfactualSafesDatasourceModule } from '@/datasources/accounts/counterfactual-safes/counterfactual-safes.datasource.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { NotificationsRepositoryV2Module } from '@/domain/notifications/v2/notifications.repository.module';
import { IUsersRepository } from '@/domain/users/users.repository.interface';
import { TestNotificationsRepositoryV2Module } from '@/domain/notifications/v2/test.notification.repository.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { UsersController } from '@/routes/users/users.controller';
import { checkGuardIsApplied } from '@/__tests__/util/check-guard';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'net';
import type { INetworkService } from '@/datasources/network/network.service.interface';

describe('UsersController', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let usersRepository: IUsersRepository;

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

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule.register(testConfiguration)],
    })
      .overrideModule(PostgresDatabaseModule)
      .useModule(TestPostgresDatabaseModule)
      .overrideModule(AccountsDatasourceModule)
      .useModule(TestAccountsDataSourceModule)
      .overrideModule(AddressBooksDatasourceModule)
      .useModule(TestAddressBooksDataSourceModule)
      .overrideModule(CounterfactualSafesDatasourceModule)
      .useModule(TestCounterfactualSafesDataSourceModule)
      .overrideModule(TargetedMessagingDatasourceModule)
      .useModule(TestTargetedMessagingDatasourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .overrideModule(NotificationsRepositoryV2Module)
      .useModule(TestNotificationsRepositoryV2Module)
      .compile();

    jwtService = moduleFixture.get<IJwtService>(IJwtService);
    networkService = moduleFixture.get(NetworkService);
    usersRepository = moduleFixture.get(IUsersRepository);

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
        .expect({
          id: 1,
        });
    });

    // Note: we could extensively test JWT validity but it is covered in the AuthGuard tests
    it('should return a 403 if not authenticated', async () => {
      await request(app.getHttpServer()).get('/v1/users/wallet').expect({
        statusCode: 403,
        message: 'Forbidden resource',
        error: 'Forbidden',
      });
    });

    it('should return a 403 is the AuthPayload is empty', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as `0x${string}`)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect({
          statusCode: 403,
          message: 'TODO',
        });
    });

    it('should return a 404 if the user is not found', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get('/v1/users')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect({
          statusCode: 404,
          message: 'User not found',
          error: 'Not Found',
        });
    });
  });

  describe('DELETE /v1/users', () => {
    it.todo('should delete the user');

    // Note: we could extensively test JWT validity but it is covered in the AuthGuard tests
    it('should return a 403 if not authenticated', async () => {
      await request(app.getHttpServer()).delete('/v1/users').expect({
        statusCode: 403,
        message: 'Forbidden resource',
        error: 'Forbidden',
      });
    });

    it('should return a 403 is the AuthPayload is empty', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as `0x${string}`)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .delete('/v1/users')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect({
          statusCode: 403,
          message: 'TODO',
        });
    });

    it.todo('should return a 409 if no user is affected');
  });

  describe('POST /v1/users/wallet', () => {
    it('should create a user with a wallet', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201)
        .expect({
          id: 1,
        });
    });

    // Note: we could extensively test JWT validity but it is covered in the AuthGuard tests
    it('should return a 403 if not authenticated', async () => {
      await request(app.getHttpServer()).post('/v1/users/wallet').expect({
        statusCode: 403,
        message: 'Forbidden resource',
        error: 'Forbidden',
      });
    });

    it('should return a 403 is the AuthPayload is empty', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as `0x${string}`)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect({
          statusCode: 403,
          message: 'TODO',
        });
    });

    it.todo('should return a 409 if the wallet already exists');
  });

  describe('DELETE /v1/users/wallet/:walletAddress', () => {
    it.todo('should delete a wallet from a user');

    // Note: we could extensively test JWT validity but it is covered in the AuthGuard tests
    it('should return a 403 if not authenticated', async () => {
      const walletAddress = getAddress(faker.finance.ethereumAddress());

      await request(app.getHttpServer())
        .delete(`/v1/users/${walletAddress}`)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('should return a 403 is the AuthPayload is empty', async () => {
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as `0x${string}`)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .delete(`/v1/users/${walletAddress}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect({
          statusCode: 403,
          message: 'TODO',
        });
    });

    it.todo('should return a 409 if the authenticated one');

    it.todo('should return a 404 if the user is not found');

    it.todo('should return a 400 if the wallet is the last one');

    it.todo('should return a 409 if the wallet could not be removed');
  });
});
