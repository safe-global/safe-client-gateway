import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { getAddress } from 'viem';
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
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { NotificationsRepositoryV2Module } from '@/domain/notifications/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/domain/notifications/v2/test.notification.repository.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { UserOrganizationsController } from '@/routes/organizations/user-organizations.controller';
import { checkGuardIsApplied } from '@/__tests__/util/check-guard';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'net';

describe('UserOrganizationsController', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let maxInvites: number;

  beforeAll(async () => {
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
    const configService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    maxInvites = configService.getOrThrow('users.maxInvites');

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should require authentication for every endpoint', () => {
    const endpoints = Object.values(
      UserOrganizationsController.prototype,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    ) as Array<Function>;

    endpoints.forEach((fn) => checkGuardIsApplied(AuthGuard, fn));
  });

  describe('POST /v1/organizations/:orgId/members/invite', () => {
    it('should invite users', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const orgName = faker.word.noun();
      const user1 = getAddress(faker.finance.ethereumAddress());
      const user1Name = faker.person.firstName();
      const user2 = getAddress(faker.finance.ethereumAddress());
      const user2Name = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'ADMIN',
              address: user1,
              name: user1Name,
            },
            {
              role: 'MEMBER',
              address: user2,
              name: user2Name,
            },
          ],
        })
        .expect(201)
        .expect(({ body }) =>
          expect(body).toEqual([
            {
              userId: expect.any(Number),
              orgId,
              name: user1Name,
              role: 'ADMIN',
              status: 'INVITED',
              invitedBy: authPayloadDto.signer_address,
            },
            {
              userId: expect.any(Number),
              orgId,
              name: user2Name,
              role: 'MEMBER',
              status: 'INVITED',
              invitedBy: authPayloadDto.signer_address,
            },
          ]),
        );
    });

    it('should throw a 409 if there are too many invites', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const orgId = faker.number.int();
      const invites = Array.from({ length: maxInvites + 1 }).map(() => {
        return {
          role: faker.helpers.arrayElement(['ADMIN', 'MEMBER']),
          address: getAddress(faker.finance.ethereumAddress()),
          name: faker.person.firstName(),
        };
      });

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ users: invites })
        .expect(409)
        .expect({
          message: 'Too many invites.',
          error: 'Conflict',
          statusCode: 409,
        });
    });

    it('should throw a 403 if the user is not authenticated', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const orgName = faker.word.noun();
      const user1 = getAddress(faker.finance.ethereumAddress());
      const user1Name = faker.person.firstName();
      const user2 = getAddress(faker.finance.ethereumAddress());
      const user2Name = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .send({
          users: [
            {
              role: 'ADMIN',
              address: user1,
              name: user1Name,
            },
            {
              role: 'MEMBER',
              address: user2,
              name: user2Name,
            },
          ],
        })
        .expect(403)
        .expect({
          message: 'Forbidden resource',
          error: 'Forbidden',
          statusCode: 403,
        });
    });

    it('should throw a 422 if no addresses are provided', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const orgName = faker.word.noun();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ users: [] })
        .expect(422);
    });

    it('should throw a 404 if the signer_address does not have a user', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const nonUserAuthPayloadDto = authPayloadDtoBuilder().build();
      const nonUserAccessToken = jwtService.sign(nonUserAuthPayloadDto);
      const orgName = faker.word.noun();
      const user1 = getAddress(faker.finance.ethereumAddress());
      const user1Name = faker.person.firstName();
      const user2 = getAddress(faker.finance.ethereumAddress());
      const user2Name = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${nonUserAccessToken}`])
        .send({
          users: [
            {
              role: 'ADMIN',
              address: user1,
              name: user1Name,
            },
            {
              role: 'MEMBER',
              address: user2,
              name: user2Name,
            },
          ],
        })
        .expect(404)
        .expect({
          message: 'User not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('should throw a 404 if the organization does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const orgId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });
      const user1 = getAddress(faker.finance.ethereumAddress());
      const user1Name = faker.person.firstName();
      const user2 = getAddress(faker.finance.ethereumAddress());
      const user2Name = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'ADMIN',
              address: user1,
              name: user1Name,
            },
            {
              role: 'MEMBER',
              address: user2,
              name: user2Name,
            },
          ],
        })
        .expect(404)
        .expect({
          message: 'Organization not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('should throw a 401 if the signer is not a member of the organization', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const nonUserOrgAuthPayloadDto = authPayloadDtoBuilder().build();
      const nonUserOrgAccessToken = jwtService.sign(nonUserOrgAuthPayloadDto);
      const orgName = faker.word.noun();
      const user1 = getAddress(faker.finance.ethereumAddress());
      const user1Name = faker.person.firstName();
      const user2 = getAddress(faker.finance.ethereumAddress());
      const user2Name = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${nonUserOrgAccessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${nonUserOrgAccessToken}`])
        .send({
          users: [
            {
              role: 'ADMIN',
              address: user1,
              name: user1Name,
            },
            {
              role: 'MEMBER',
              address: user2,
              name: user2Name,
            },
          ],
        })
        .expect(401)
        .expect({
          message: 'Signer is not an active admin.',
          error: 'Unauthorized',
          statusCode: 401,
        });
    });

    it('should throw a 401 if the signer is not an admin', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const inviteeAuthPayloadDto = authPayloadDtoBuilder().build();
      const inviteeAccessToken = jwtService.sign(inviteeAuthPayloadDto);
      const orgName = faker.word.noun();
      const user = getAddress(faker.finance.ethereumAddress());
      const userName = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER', // Should be ADMIN to invite new members
              address: inviteeAuthPayloadDto.signer_address,
              name: userName,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: user,
              name: userName,
            },
          ],
        })
        .expect(401)
        .expect({
          message: 'Signer is not an active admin.',
          error: 'Unauthorized',
          statusCode: 401,
        });
    });

    it('should throw a 401 if the signer is not an active admin', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const inviteeAuthPayloadDto = authPayloadDtoBuilder().build();
      const inviteeAccessToken = jwtService.sign(inviteeAuthPayloadDto);
      const orgName = faker.word.noun();
      const user = getAddress(faker.finance.ethereumAddress());
      const userName = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'ADMIN', // Should be ACTIVE to invite new members
              address: inviteeAuthPayloadDto.signer_address,
              name: userName,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: user,
              name: userName,
            },
          ],
        })
        .expect(401)
        .expect({
          message: 'Signer is not an active admin.',
          error: 'Unauthorized',
          statusCode: 401,
        });
    });
  });

  describe('POST /v1/organizations/:orgId/members/accept', () => {
    it('should accept an invite for a user', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const inviteeAuthPayloadDto = authPayloadDtoBuilder().build();
      const inviteeAccessToken = jwtService.sign(inviteeAuthPayloadDto);
      const orgName = faker.word.noun();
      const orgUserName = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: orgUserName,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/accept`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({
          name: orgUserName,
        })
        .expect(201)
        .expect({});
    });

    it('should accept an invite for a user, changing name', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const inviteeAuthPayloadDto = authPayloadDtoBuilder().build();
      const inviteeAccessToken = jwtService.sign(inviteeAuthPayloadDto);
      const orgName = faker.word.noun();
      const orgInvitedUserName = faker.person.firstName();
      const orgAcceptedUserName = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: orgInvitedUserName,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/accept`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({
          name: orgAcceptedUserName,
        })
        .expect(201)
        .expect({});
    });

    it('should throw a 403 if the user is not authenticated', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const inviteeAuthPayloadDto = authPayloadDtoBuilder().build();
      const orgName = faker.word.noun();
      const orgUserName = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: orgUserName,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/accept`)
        .send({
          name: orgUserName,
        })
        .expect(403)
        .expect({
          message: 'Forbidden resource',
          error: 'Forbidden',
          statusCode: 403,
        });
    });

    it('should throw a 404 if the signer_address does not have a user', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const nonUserAuthPayloadDto = authPayloadDtoBuilder().build();
      const nonUserAccessToken = jwtService.sign(nonUserAuthPayloadDto);
      const orgName = faker.word.noun();
      const orgUserName = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/accept`)
        .set('Cookie', [`access_token=${nonUserAccessToken}`])
        .send({
          name: orgUserName,
        })
        .expect(404)
        .expect({
          message: 'User not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('should throw a 404 if the organization does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const orgId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });
      const orgUserName = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/accept`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          name: orgUserName,
        })
        .expect(404)
        .expect({
          message: 'Organization not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('should throw a 404 if the user organization does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const nonUserOrgAuthPayloadDto = authPayloadDtoBuilder().build();
      const nonUserOrgAuthPayload = jwtService.sign(nonUserOrgAuthPayloadDto);
      const orgName = faker.word.noun();
      const user = getAddress(faker.finance.ethereumAddress());
      const orgUserName = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${nonUserOrgAuthPayload}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: user,
              name: orgUserName,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/accept`)
        .set('Cookie', [`access_token=${nonUserOrgAuthPayload}`])
        .send({
          name: orgUserName,
        })
        .expect(404)
        .expect({
          message: 'Organization not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('should throw a 404 if the status of the user organization is not INVITED', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const inviteeAuthPayloadDto = authPayloadDtoBuilder().build();
      const inviteeAccessToken = jwtService.sign(inviteeAuthPayloadDto);
      const orgName = faker.word.noun();
      const orgUserName = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: orgUserName,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/accept`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({
          name: orgUserName,
        })
        .expect(201)
        .expect({});

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/accept`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({
          name: orgUserName,
        })
        .expect(404)
        .expect({
          message: 'Organization not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('should throw a 422 if the user name is not provided', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const inviteeAuthPayloadDto = authPayloadDtoBuilder().build();
      const inviteeAccessToken = jwtService.sign(inviteeAuthPayloadDto);
      const orgName = faker.word.noun();
      const orgUserName = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: orgUserName,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/accept`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
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

  describe('POST /v1/organizations/:orgId/members/decline', () => {
    it('should decline an invite for a user', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const inviteeAuthPayloadDto = authPayloadDtoBuilder().build();
      const inviteeAccessToken = jwtService.sign(inviteeAuthPayloadDto);
      const orgName = faker.word.noun();
      const orgUserName = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: orgUserName,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/decline`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .expect(201)
        .expect({});
    });

    it('should throw a 403 if the user is not authenticated', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const inviteeAuthPayloadDto = authPayloadDtoBuilder().build();
      const orgName = faker.word.noun();
      const orgUserName = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: orgUserName,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/decline`)
        .expect(403)
        .expect({
          message: 'Forbidden resource',
          error: 'Forbidden',
          statusCode: 403,
        });
    });

    it('should throw a 404 if the signer_address does not have a user', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const nonUserAuthPayloadDto = authPayloadDtoBuilder().build();
      const nonUserAccessToken = jwtService.sign(nonUserAuthPayloadDto);
      const orgName = faker.word.noun();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/decline`)
        .set('Cookie', [`access_token=${nonUserAccessToken}`])
        .expect(404)
        .expect({
          message: 'User not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('should throw a 404 if the organization does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const orgId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/decline`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404)
        .expect({
          message: 'Organization not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('should throw a 404 if the user organization does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const nonUserOrgAuthPayloadDto = authPayloadDtoBuilder().build();
      const nonUserOrgAuthPayload = jwtService.sign(nonUserOrgAuthPayloadDto);
      const orgName = faker.word.noun();
      const orgUserName = faker.person.firstName();
      const user = getAddress(faker.finance.ethereumAddress());

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${nonUserOrgAuthPayload}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: user,
              name: orgUserName,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/decline`)
        .set('Cookie', [`access_token=${nonUserOrgAuthPayload}`])
        .expect(404)
        .expect({
          message: 'Organization not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('should throw a 404 if the status of the user organization is not INVITED', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const inviteeAuthPayloadDto = authPayloadDtoBuilder().build();
      const inviteeAccessToken = jwtService.sign(inviteeAuthPayloadDto);
      const orgName = faker.word.noun();
      const orgUserName = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: orgUserName,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/decline`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .expect(201)
        .expect({});

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/decline`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .expect(404)
        .expect({
          message: 'Organization not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });
  });

  describe('GET /v1/organizations/:orgId/members', () => {
    it('should return a list of members of an organization', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const orgName = faker.word.noun();
      const user1 = getAddress(faker.finance.ethereumAddress());
      const user1Name = faker.person.firstName();
      const user2 = getAddress(faker.finance.ethereumAddress());
      const user2Name = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'ADMIN',
              address: user1,
              name: user1Name,
            },
            {
              role: 'MEMBER',
              address: user2,
              name: user2Name,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/v1/organizations/${orgId}/members`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            members: [
              {
                id: expect.any(Number),
                role: 'ADMIN',
                status: 'ACTIVE',
                name: `${orgName} creator`,
                invitedBy: null, // org creator's `invitedBy` field value is null
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
                user: {
                  id: expect.any(Number),
                  status: 'ACTIVE',
                },
              },
              {
                id: expect.any(Number),
                role: 'ADMIN',
                status: 'INVITED',
                name: user1Name,
                invitedBy: authPayloadDto.signer_address,
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
                user: {
                  id: expect.any(Number),
                  status: 'PENDING',
                },
              },
              {
                id: expect.any(Number),
                role: 'MEMBER',
                status: 'INVITED',
                name: user2Name,
                invitedBy: authPayloadDto.signer_address,
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
                user: {
                  id: expect.any(Number),
                  status: 'PENDING',
                },
              },
            ],
          });
        });
    });

    it('should throw a 403 if the user is not authenticated', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const orgName = faker.word.noun();
      const user1 = getAddress(faker.finance.ethereumAddress());
      const user1Name = faker.person.firstName();
      const user2 = getAddress(faker.finance.ethereumAddress());
      const user2Name = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'ADMIN',
              address: user1,
              name: user1Name,
            },
            {
              role: 'MEMBER',
              address: user2,
              name: user2Name,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/v1/organizations/${orgId}/members`)
        .expect(403)
        .expect({
          message: 'Forbidden resource',
          error: 'Forbidden',
          statusCode: 403,
        });
    });

    it('should throw a 404 if the signer_address does not have a user', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const nonUserAuthPayloadDto = authPayloadDtoBuilder().build();
      const nonUserAccessToken = jwtService.sign(nonUserAuthPayloadDto);
      const orgName = faker.word.noun();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .get(`/v1/organizations/${orgId}/members`)
        .set('Cookie', [`access_token=${nonUserAccessToken}`])
        .expect(404)
        .expect({
          message: 'User not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('should throw a 401 if the user is not a member of the organization', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      // Organization does not even exist
      const orgId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .get(`/v1/organizations/${orgId}/members`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(401)
        .expect({
          message: 'The user is not an active member of the organization.',
          error: 'Unauthorized',
          statusCode: 401,
        });
    });

    it('should throw a 401 if the user is not an active member of the organization', async () => {
      const adminAuthPayloadDto = authPayloadDtoBuilder().build();
      const adminAccessToken = jwtService.sign(adminAuthPayloadDto);
      const orgName = faker.word.noun();
      const memberAddress = getAddress(faker.finance.ethereumAddress());
      const memberAuthPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', memberAddress)
        .build();
      const memberAccessToken = jwtService.sign(memberAuthPayloadDto);
      const memberName = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: memberAddress,
              name: memberName,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/v1/organizations/${orgId}/members`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .expect(401)
        .expect({
          message: 'The user is not an active member of the organization.',
          error: 'Unauthorized',
          statusCode: 401,
        });
    });
  });

  describe('PATCH /v1/organizations/:orgId/members/:userId/role', () => {
    it('should update the role of userId', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const inviteeAuthPayloadDto = authPayloadDtoBuilder().build();
      const inviteeAccessToken = jwtService.sign(inviteeAuthPayloadDto);
      const orgName = faker.word.noun();
      const orgUserName = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      const inviteUsersResponse = await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: orgUserName,
            },
          ],
        })
        .expect(201);
      const userId = inviteUsersResponse.body[0].userId;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/accept`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({
          name: orgUserName,
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/v1/organizations/${orgId}/members/${userId}/role`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ role: 'ADMIN' })
        .expect(200)
        .expect({});
    });

    it('should throw a 403 if the user is not authenticated', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const inviteeAuthPayloadDto = authPayloadDtoBuilder().build();
      const inviteeAccessToken = jwtService.sign(inviteeAuthPayloadDto);
      const orgName = faker.word.noun();
      const orgUserName = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      const inviteUsersResponse = await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: orgUserName,
            },
          ],
        })
        .expect(201);
      const userId = inviteUsersResponse.body[0].userId;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/accept`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({
          name: orgUserName,
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/v1/organizations/${orgId}/members/${userId}/role`)
        .send({ role: 'ADMIN' })
        .expect(403)
        .expect({
          message: 'Forbidden resource',
          error: 'Forbidden',
          statusCode: 403,
        });
    });

    it('should throw a 404 if the signer_address does not have a user', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const inviteeAuthPayloadDto = authPayloadDtoBuilder().build();
      const inviteeAccessToken = jwtService.sign(inviteeAuthPayloadDto);
      const nonUserAuthPayloadDto = authPayloadDtoBuilder().build();
      const nonUserAccessToken = jwtService.sign(nonUserAuthPayloadDto);
      const orgName = faker.word.noun();
      const orgUserName = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      const inviteUsersResponse = await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: orgUserName,
            },
          ],
        })
        .expect(201);
      const userId = inviteUsersResponse.body[0].userId;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/accept`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({
          name: orgUserName,
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/v1/organizations/${orgId}/members/${userId}/role`)
        .set('Cookie', [`access_token=${nonUserAccessToken}`])
        .send({ role: 'ADMIN' })
        .expect(404)
        .expect({
          message: 'User not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('should throw a 401 if the status of the signer user organization is not ACTIVE', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const inviteeAuthPayloadDto = authPayloadDtoBuilder().build();
      const inviteeAccessToken = jwtService.sign(inviteeAuthPayloadDto);
      const orgName = faker.word.noun();
      const orgUserName = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      const inviteUsersResponse = await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: orgUserName,
            },
          ],
        })
        .expect(201);
      const userId = inviteUsersResponse.body[0].userId;

      await request(app.getHttpServer())
        .patch(`/v1/organizations/${orgId}/members/${userId}/role`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({ role: 'ADMIN' })
        .expect(401)
        .expect({
          message: 'Signer is not an active admin.',
          error: 'Unauthorized',
          statusCode: 401,
        });
    });

    it('should throw a 401 if the signer user organization is not of ADMIN role', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const inviteeAuthPayloadDto = authPayloadDtoBuilder().build();
      const inviteeAccessToken = jwtService.sign(inviteeAuthPayloadDto);
      const orgName = faker.word.noun();
      const orgUserName = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      const inviteUsersResponse = await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: orgUserName,
            },
          ],
        })
        .expect(201);
      const userId = inviteUsersResponse.body[0].userId;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/accept`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({
          name: orgUserName,
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/v1/organizations/${orgId}/members/${userId}/role`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({ role: 'ADMIN' })
        .expect(401)
        .expect({
          message: 'Signer is not an active admin.',
          error: 'Unauthorized',
          statusCode: 401,
        });
    });

    it('should throw a 409 if downgrading the last ACTIVE ADMIN', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const orgName = faker.word.noun();

      const createUserResponse = await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);
      const userId = createUserResponse.body.id;

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .patch(`/v1/organizations/${orgId}/members/${userId}/role`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ role: 'MEMBER' })
        .expect(409)
        .expect({
          message: 'Cannot remove last admin.',
          error: 'Conflict',
          statusCode: 409,
        });
    });

    it('should throw a 404 if the user-to-update user organization does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const nonUserOrgAuthPayloadDto = authPayloadDtoBuilder().build();
      const nonUserOrgAuthPayload = jwtService.sign(nonUserOrgAuthPayloadDto);
      const orgName = faker.word.noun();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createUserResponse = await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${nonUserOrgAuthPayload}`])
        .expect(201);
      const userId = createUserResponse.body.id;

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .patch(`/v1/organizations/${orgId}/members/${userId}/role`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ role: 'ADMIN' })
        .expect(404)
        .expect({
          message: 'User organization not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });
  });

  describe('DELETE /v1/organizations/:orgId/members/:userId', () => {
    it('should remove a user', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const inviteeAuthPayloadDto = authPayloadDtoBuilder().build();
      const inviteeAccessToken = jwtService.sign(inviteeAuthPayloadDto);
      const orgName = faker.word.noun();
      const orgUserName = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      const inviteUsersResponse = await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'ADMIN',
              address: inviteeAuthPayloadDto.signer_address,
              name: orgUserName,
            },
          ],
        })
        .expect(201);
      const userId = inviteUsersResponse.body[0].userId;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/accept`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({
          name: orgUserName,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/organizations/${orgId}/members/${userId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({});
    });

    it('should throw a 404 if the signer_address does not have a user', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const nonUserAuthPayloadDto = authPayloadDtoBuilder().build();
      const nonUserAccessToken = jwtService.sign(nonUserAuthPayloadDto);
      const orgName = faker.word.noun();
      const userId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .delete(`/v1/organizations/${orgId}/members/${userId}`)
        .set('Cookie', [`access_token=${nonUserAccessToken}`])
        .expect(404)
        .expect({
          message: 'User not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('should throw a 404 if the organization does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const orgId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      const createUserResponse = await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);
      const userId = createUserResponse.body.id;

      await request(app.getHttpServer())
        .delete(`/v1/organizations/${orgId}/members/${userId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404)
        .expect({
          message: 'No user organizations found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('should throw a 401 if the status of the signer user organization is not ACTIVE', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const inviteeAuthPayloadDto = authPayloadDtoBuilder().build();
      const inviteeAccessToken = jwtService.sign(inviteeAuthPayloadDto);
      const member = getAddress(faker.finance.ethereumAddress());
      const orgName = faker.word.noun();
      const adminName = faker.person.firstName();
      const memberName = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      const inviteUsersResponse = await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'ADMIN',
              address: inviteeAuthPayloadDto.signer_address,
              name: adminName,
            },
            {
              role: 'MEMBER',
              address: member,
              name: memberName,
            },
          ],
        })
        .expect(201);
      const memberUserId = inviteUsersResponse.body[1].userId;

      await request(app.getHttpServer())
        .delete(`/v1/organizations/${orgId}/members/${memberUserId}`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .expect(401)
        .expect({
          message: 'Signer is not an active admin.',
          error: 'Unauthorized',
          statusCode: 401,
        });
    });

    it('should throw a 401 if the signer user organization is not of ADMIN status', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const inviteeAuthPayloadDto = authPayloadDtoBuilder().build();
      const inviteeAccessToken = jwtService.sign(inviteeAuthPayloadDto);
      const orgName = faker.word.noun();
      const orgUserName = faker.person.firstName();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      const inviteUsersResponse = await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: orgUserName,
            },
          ],
        })
        .expect(201);
      const userId = inviteUsersResponse.body[0].userId;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/accept`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({
          name: orgUserName,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/organizations/${orgId}/members/${userId}`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .expect(401)
        .expect({
          message: 'Signer is not an active admin.',
          error: 'Unauthorized',
          statusCode: 401,
        });
    });

    it('should throw a 409 if removing the last ACTIVE ADMIN', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const orgName = faker.word.noun();

      const createUserResponse = await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);
      const userId = createUserResponse.body.id;

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName })
        .expect(201);
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .delete(`/v1/organizations/${orgId}/members/${userId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(409)
        .expect({
          message: 'Cannot remove last admin.',
          error: 'Conflict',
          statusCode: 409,
        });
    });
  });
});
