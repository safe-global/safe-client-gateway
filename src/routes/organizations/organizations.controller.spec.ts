import { type Server } from 'http';
import { Test } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { NetworkModule } from '@/datasources/network/network.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { AccountsDatasourceModule } from '@/datasources/accounts/accounts.datasource.module';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { NotificationsRepositoryV2Module } from '@/domain/notifications/v2/notifications.repository.module';
import { TestAccountsDataSourceModule } from '@/datasources/accounts/__tests__/test.accounts.datasource.module';
import { TestNotificationsRepositoryV2Module } from '@/domain/notifications/v2/test.notification.repository.module';
import { AddressBooksDatasourceModule } from '@/datasources/accounts/address-books/address-books.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { TestAddressBooksDataSourceModule } from '@/datasources/accounts/address-books/__tests__/test.address-books.datasource.module';
import { CounterfactualSafesDatasourceModule } from '@/datasources/accounts/counterfactual-safes/counterfactual-safes.datasource.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TestCounterfactualSafesDataSourceModule } from '@/datasources/accounts/counterfactual-safes/__tests__/test.counterfactual-safes.datasource.module';
import { OrganizationsController } from '@/routes/organizations/organizations.controller';
import { checkGuardIsApplied } from '@/__tests__/util/check-guard';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { faker } from '@faker-js/faker/.';
import { OrganizationStatus } from '@/domain/organizations/entities/organization.entity';
import {
  UserOrganizationRole,
  UserOrganizationStatus,
} from '@/domain/users/entities/user-organization.entity';
import { UserStatus } from '@/domain/users/entities/user.entity';

describe('OrganizationController', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;

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

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should require authentication for every endpoint', () => {
    const endpoints = Object.values(
      OrganizationsController.prototype,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    ) as Array<Function>;

    endpoints.forEach((fn) => checkGuardIsApplied(AuthGuard, fn));
  });

  describe('POST /v1/organizations', () => {
    it('Should create an organization', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const organizationName = faker.company.name();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: organizationName })
        .expect(201)
        .expect(({ body }) =>
          expect(body).toEqual({
            id: expect.any(Number),
            name: organizationName,
          }),
        );
    });

    it('should return a 403 if not authenticated', async () => {
      await request(app.getHttpServer())
        .post('/v1/organizations')
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('Should return a 403 if the AuthPayload is empty', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as `0x${string}`)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('Should return a 404 if user is not found', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const organizationName = faker.company.name();

      await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: organizationName })
        .expect(404)
        .expect({
          statusCode: 404,
          message: 'User not found.',
          error: 'Not Found',
        });
    });

    it('Should return a 422 if no name is provided', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send()
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'invalid_type',
          expected: 'object',
          received: 'undefined',
          path: [],
          message: 'Required',
        });
    });
  });

  describe('GET /organizations', () => {
    it('Should return a list of organizations', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const firstOrganizationName = faker.company.name();
      const secondOrganizationName = faker.company.name();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: firstOrganizationName })
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: secondOrganizationName })
        .expect(201);

      await request(app.getHttpServer())
        .get('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual([
            {
              id: expect.any(Number),
              name: firstOrganizationName,
              status: OrganizationStatus.ACTIVE,
              user_organizations: [
                {
                  id: expect.any(Number),
                  role: UserOrganizationRole.ADMIN,
                  status: UserOrganizationStatus.ACTIVE,
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                  user: {
                    id: expect.any(Number),
                    status: UserStatus.ACTIVE,
                  },
                },
              ],
            },
            {
              id: expect.any(Number),
              name: secondOrganizationName,
              status: OrganizationStatus.ACTIVE,
              user_organizations: [
                {
                  id: expect.any(Number),
                  role: UserOrganizationRole.ADMIN,
                  status: UserOrganizationStatus.ACTIVE,
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                  user: {
                    id: expect.any(Number),
                    status: UserStatus.ACTIVE,
                  },
                },
              ],
            },
          ]);
        });
    });

    it('Should return a 404 if the user does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404)
        .expect({
          message: 'User not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('should return a 403 if not authenticated', async () => {
      await request(app.getHttpServer())
        .get('/v1/organizations')
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('Should return a 403 is the AuthPayload is empty', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as `0x${string}`)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });
  });

  describe('GET /organizations/:id', () => {
    it('Should return an organization by its id', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const organizationName = faker.company.name();

      const createUserResponse = await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);
      const userId = createUserResponse.body.id;

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: organizationName })
        .expect(201);
      const organizationId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .get(`/v1/organizations/${organizationId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            id: organizationId,
            name: organizationName,
            status: OrganizationStatus.ACTIVE,
            user_organizations: [
              {
                id: expect.any(Number),
                status: UserOrganizationStatus.ACTIVE,
                role: UserOrganizationRole.ADMIN,
                created_at: expect.any(String),
                updated_at: expect.any(String),
                user: {
                  id: userId,
                  status: UserStatus.ACTIVE,
                },
              },
            ],
          });
        });
    });

    it('Should return a 404 if an organization id does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const organizationId = faker.number.int({ min: 10000, max: 20000 });

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .get(`/v1/organizations/${organizationId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404)
        .expect({
          statusCode: 404,
          message: 'Organization not found.',
          error: 'Not Found',
        });
    });

    it('Should return a 404 if the user does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const organizationId = faker.number.int({ min: 10000, max: 20000 });

      await request(app.getHttpServer())
        .get(`/v1/organizations/${organizationId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404)
        .expect({
          statusCode: 404,
          message: 'User not found.',
          error: 'Not Found',
        });
    });

    it('should return a 403 if not authenticated', async () => {
      await request(app.getHttpServer())
        .get('/v1/organizations')
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('Should return a 403 is the AuthPayload is empty', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as `0x${string}`)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });
  });

  describe('PATCH /organizations/:id', () => {
    it('Should update an organization', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const previousOrganizationName = faker.company.name();
      const newOrganizationName = faker.company.name();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: previousOrganizationName });

      const organizationId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .patch(`/v1/organizations/${organizationId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: newOrganizationName, status: OrganizationStatus.ACTIVE })
        .expect(200)
        .expect(({ body }) =>
          expect(body).toEqual({
            id: organizationId,
          }),
        );
    });

    it('should return a 403 if not authenticated', async () => {
      const organizationId = faker.number.int({ min: 900000, max: 990000 });

      await request(app.getHttpServer())
        .patch(`/v1/organizations/${organizationId}`)
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('Should return a 403 is the AuthPayload is empty', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as `0x${string}`)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const organizationId = faker.number.int({ min: 1 });

      await request(app.getHttpServer())
        .patch(`/v1/organizations/${organizationId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('Should throw a 401 if user can not update an organization because organization does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const organizationName = faker.company.name();
      const organizationId = faker.number.int({ min: 900000, max: 990000 });

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      await request(app.getHttpServer())
        .patch(`/v1/organizations/${organizationId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: organizationName, status: OrganizationStatus.ACTIVE })
        .expect(401)
        .expect(({ body }) =>
          expect(body).toEqual({
            statusCode: 401,
            error: 'Unauthorized',
            message:
              'User is unauthorized. SignerAddress= ' +
              authPayloadDto.signer_address,
          }),
        );
    });

    it.todo(
      'Should throw a 401 if user does not have access to update an organization',
    ); // @todo Needs membership logic
  });

  describe('DELETE /organizations/:id', () => {
    it('Should delete an organization', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const organizationName = faker.company.name();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: organizationName });

      const organizationId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .delete(`/v1/organizations/${organizationId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(204);
    });

    it('Should throw a 401 if user can not update an organization because organization does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const organizationName = faker.company.name();
      const organizationId = faker.number.int({ min: 900000, max: 990000 });

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      await request(app.getHttpServer())
        .patch(`/v1/organizations/${organizationId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: organizationName, status: OrganizationStatus.ACTIVE })
        .expect(401)
        .expect(({ body }) =>
          expect(body).toEqual({
            statusCode: 401,
            error: 'Unauthorized',
            message:
              'User is unauthorized. SignerAddress= ' +
              authPayloadDto.signer_address,
          }),
        );
    });

    it.todo(
      'Should throw a 401 if user does not have access to update an organization',
    ); // @todo Needs membership logic

    it('Should return a 403 is the AuthPayload is empty', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as `0x${string}`)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const organizationId = faker.number.int({ min: 1 });

      await request(app.getHttpServer())
        .delete(`/v1/organizations/${organizationId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('should return a 403 if not authenticated', async () => {
      const organizationId = faker.number.int({ min: 900000, max: 990000 });

      await request(app.getHttpServer())
        .delete(`/v1/organizations/${organizationId}`)
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });
  });
});
