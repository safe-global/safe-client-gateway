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
import { OrganizationSafesController } from '@/routes/organizations/organization-safes.controller';
import { checkGuardIsApplied } from '@/__tests__/util/check-guard';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { faker } from '@faker-js/faker/.';
import { getAddress } from 'viem';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';

describe('OrganizationSafeController', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;

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

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should require authentication for every endpoint', () => {
    const endpoints = Object.values(
      OrganizationSafesController.prototype,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    ) as Array<Function>;

    endpoints.forEach((fn) => checkGuardIsApplied(AuthGuard, fn));
  });

  describe('POST /v1/organizations/:organizationId/safes', () => {
    it('Should create a new organization safe', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const orgName = faker.company.name();
      const chain = chainBuilder().build();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName });
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          safes: [
            {
              chainId: chain.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        })
        .expect(201);
    });

    it('Should create multiple new organization safes', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const orgName = faker.company.name();
      const chain1 = chainBuilder().build();
      const chain2 = chainBuilder().build();
      const chain3 = chainBuilder().build();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName });
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          safes: [
            {
              chainId: chain1.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
            },
            {
              chainId: chain2.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
            },
            {
              chainId: chain3.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        })
        .expect(201);
    });

    it('Should fail on duplicate organization safes', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const orgName = faker.company.name();
      const chain1 = chainBuilder().build();
      const chain2 = chainBuilder().build();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName });
      const orgId = createOrganizationResponse.body.id;
      const orgSafe1 = {
        chainId: chain1.chainId,
        address: getAddress(faker.finance.ethereumAddress()),
      };
      const orgSafe2 = {
        chainId: chain2.chainId,
        address: getAddress(faker.finance.ethereumAddress()),
      };
      const duplicatedOrgSafe = {
        chainId: orgSafe1.chainId,
        address: orgSafe1.address,
      };

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          safes: [orgSafe1, orgSafe2, duplicatedOrgSafe],
        })
        .expect(409)
        .expect({
          message:
            'An OrganizationSafe with the same chainId and address already exists.',
          statusCode: 409,
        });
    });

    it('Should return a 401 if user is not authorized', async () => {
      const adminAuthPayloadDto = authPayloadDtoBuilder().build();
      const adminAccessToken = jwtService.sign(adminAuthPayloadDto);
      const userAuthPayloadDto = authPayloadDtoBuilder().build();
      const userAccessToken = jwtService.sign(userAuthPayloadDto);
      const orgName = faker.company.name();
      const chain = chainBuilder().build();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${adminAccessToken}`]);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${userAccessToken}`]);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({ name: orgName });
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${userAccessToken}`])
        .send({
          safes: [
            {
              chainId: chain.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        })
        .expect(401)
        .expect({
          error: 'Unauthorized',
          message:
            'User is unauthorized. signer_address= ' +
            userAuthPayloadDto.signer_address,
          statusCode: 401,
        });
    });

    it('Should return a 401 for a MEMBER of an organization', async () => {
      const adminAuthPayloadDto = authPayloadDtoBuilder().build();
      const adminAccessToken = jwtService.sign(adminAuthPayloadDto);
      const memberAuthPayloadDto = authPayloadDtoBuilder().build();
      const memberAccessToken = jwtService.sign(memberAuthPayloadDto);
      const orgName = faker.company.name();
      const chain = chainBuilder().build();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${adminAccessToken}`]);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({ name: orgName });
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/invite`)
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({
          users: [
            {
              address: getAddress(memberAuthPayloadDto.signer_address),
              role: 'MEMBER',
            },
          ],
        });

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/members/accept`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send();

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({
          safes: [
            {
              chainId: chain.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        })
        .expect(401)
        .expect({
          error: 'Unauthorized',
          message:
            'User is unauthorized. signer_address= ' +
            memberAuthPayloadDto.signer_address,
          statusCode: 401,
        });
    });

    it('should return a 403 if not authenticated', async () => {
      const orgId = faker.number.int();
      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/safes`)
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
      const orgId = faker.number.int();

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/safes`)
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
      const chain = chainBuilder().build();
      const orgId = faker.number.int();

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          safes: [
            {
              chainId: chain.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        })
        .expect(404)
        .expect({
          statusCode: 404,
          message: 'User not found.',
          error: 'Not Found',
        });
    });

    it('Should return a 422 if body is an empty array', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const orgId = faker.number.int();

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ safes: [] })
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'too_small',
          minimum: 1,
          type: 'array',
          inclusive: true,
          exact: false,
          message: 'Array must contain at least 1 element(s)',
          path: ['safes'],
        });
    });

    it('Should return a 422 if any of the chainIds is invalid', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const chain2 = chainBuilder().build();
      const orgId = faker.number.int();

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          safes: [
            {
              chainId: 111,
              address: getAddress(faker.finance.ethereumAddress()),
            },
            {
              chainId: chain2.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        })
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['safes', 0, 'chainId'],
          message: 'Expected string, received number',
        });
    });

    it('Should return a 422 if any of the addresses is invalid', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const chain1 = chainBuilder().build();
      const chain2 = chainBuilder().build();
      const orgId = faker.number.int();

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          safes: [
            {
              chainId: chain1.chainId,
              address: 'invalid-address',
            },
            {
              chainId: chain2.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        })
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'custom',
          message: 'Invalid address',
          path: ['safes', 0, 'address'],
        });
    });

    it('Should return a 422 if organization id is bigger than the max limit', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const chainIdMinLength = 79;
      const min = BigInt('1' + '0'.repeat(chainIdMinLength - 1));
      const max = BigInt('9'.repeat(chainIdMinLength));
      const chain1 = chainBuilder()
        .with('chainId', faker.number.bigInt({ min, max }).toString())
        .build();
      const chain2 = chainBuilder().build();
      const orgId = faker.string.alpha();

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          safes: [
            {
              chainId: chain1.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
            },
            {
              chainId: chain2.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        })
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'custom',
          message: 'Value must be less than or euqal to 78',
          path: ['safes', 0, 'chainId'],
        });
    });

    it('Should return a 400 if organization id is invalid', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const chain1 = chainBuilder().build();
      const chain2 = chainBuilder().build();
      const orgId = faker.string.alpha();

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          safes: [
            {
              chainId: chain1.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
            },
            {
              chainId: chain2.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        })
        .expect(400)
        .expect({
          message: 'Validation failed (numeric string is expected)',
          error: 'Bad Request',
          statusCode: 400,
        });
    });
  });

  describe('GET /organizations/:organizationId/safes', () => {
    it('Should return a list of organization safes', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const orgName = faker.company.name();
      const chain1 = chainBuilder()
        .with('chainId', faker.string.numeric({ length: { min: 1, max: 2 } }))
        .build();
      const chain2 = chainBuilder()
        .with('chainId', faker.string.numeric({ length: { min: 3, max: 4 } }))
        .build();
      const createOrgSafePayload = {
        safes: [
          {
            chainId: chain1.chainId,
            address: getAddress(faker.finance.ethereumAddress()),
          },
          {
            chainId: chain2.chainId,
            address: getAddress(faker.finance.ethereumAddress()),
          },
          {
            chainId: chain2.chainId,
            address: getAddress(faker.finance.ethereumAddress()),
          },
        ],
      };

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName });
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(createOrgSafePayload);

      await request(app.getHttpServer())
        .get(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({
          safes: {
            [chain1.chainId]: [createOrgSafePayload.safes[0].address],
            [chain2.chainId]: [
              createOrgSafePayload.safes[1].address,
              createOrgSafePayload.safes[2].address,
            ],
          },
        });
    });

    it('Should return a 401 if user is not authorized', async () => {
      const adminAuthPayloadDto = authPayloadDtoBuilder().build();
      const adminAccessToken = jwtService.sign(adminAuthPayloadDto);
      const userAuthPayloadDto = authPayloadDtoBuilder().build();
      const userAccessToken = jwtService.sign(userAuthPayloadDto);
      const orgName = faker.company.name();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${adminAccessToken}`]);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${userAccessToken}`]);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({ name: orgName });
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .get(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${userAccessToken}`])
        .expect(401)
        .expect({
          error: 'Unauthorized',
          message:
            'User is unauthorized. signer_address= ' +
            userAuthPayloadDto.signer_address,
          statusCode: 401,
        });
    });

    it('should return a 403 if not authenticated', async () => {
      const orgId = faker.number.int();
      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/safes`)
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
      const orgId = faker.number.int();

      await request(app.getHttpServer())
        .get(`/v1/organizations/${orgId}/safes`)
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
      const orgId = faker.number.int();

      await request(app.getHttpServer())
        .get(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404)
        .expect({
          statusCode: 404,
          message: 'User not found.',
          error: 'Not Found',
        });
    });

    it('Should return a 400 if organization id is invalid', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const orgId = faker.string.alpha();

      await request(app.getHttpServer())
        .get(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(400)
        .expect({
          message: 'Validation failed (numeric string is expected)',
          error: 'Bad Request',
          statusCode: 400,
        });
    });
  });

  describe('DELETE /v1/organizations/:organizationId/safes', () => {
    it('Should delete an organization safe', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const orgName = faker.company.name();
      const chain = chainBuilder().build();
      const orgSafes = {
        safes: [
          {
            chainId: chain.chainId,
            address: getAddress(faker.finance.ethereumAddress()),
          },
        ],
      };

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName });
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(orgSafes);

      await request(app.getHttpServer())
        .delete(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(orgSafes)
        .expect(204);
    });

    it('Should delete multiple organization safes', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const orgName = faker.company.name();
      const chain1 = chainBuilder().build();
      const chain2 = chainBuilder().build();
      const chain3 = chainBuilder().build();
      const orgSafes = {
        safes: [
          {
            chainId: chain1.chainId,
            address: getAddress(faker.finance.ethereumAddress()),
          },
          {
            chainId: chain2.chainId,
            address: getAddress(faker.finance.ethereumAddress()),
          },
          {
            chainId: chain3.chainId,
            address: getAddress(faker.finance.ethereumAddress()),
          },
        ],
      };

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: orgName });
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(orgSafes);

      await request(app.getHttpServer())
        .delete(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(orgSafes)
        .expect(204);
    });

    it('Should return a 401 if user is not authorized', async () => {
      const adminAuthPayloadDto = authPayloadDtoBuilder().build();
      const adminAccessToken = jwtService.sign(adminAuthPayloadDto);
      const userAuthPayloadDto = authPayloadDtoBuilder().build();
      const userAccessToken = jwtService.sign(userAuthPayloadDto);
      const orgName = faker.company.name();
      const chain1 = chainBuilder().build();
      const chain2 = chainBuilder().build();
      const chain3 = chainBuilder().build();
      const orgSafes = {
        safes: [
          {
            chainId: chain1.chainId,
            address: getAddress(faker.finance.ethereumAddress()),
          },
          {
            chainId: chain2.chainId,
            address: getAddress(faker.finance.ethereumAddress()),
          },
          {
            chainId: chain3.chainId,
            address: getAddress(faker.finance.ethereumAddress()),
          },
        ],
      };

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${adminAccessToken}`]);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${userAccessToken}`]);

      const createOrganizationResponse = await request(app.getHttpServer())
        .post('/v1/organizations')
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({ name: orgName });
      const orgId = createOrganizationResponse.body.id;

      await request(app.getHttpServer())
        .delete(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send(orgSafes);

      await request(app.getHttpServer())
        .delete(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${userAccessToken}`])
        .send(orgSafes)
        .expect(401)
        .expect({
          error: 'Unauthorized',
          message:
            'User is unauthorized. signer_address= ' +
            userAuthPayloadDto.signer_address,
          statusCode: 401,
        });
    });

    it('should return a 403 if not authenticated', async () => {
      const orgId = faker.number.int();
      await request(app.getHttpServer())
        .delete(`/v1/organizations/${orgId}/safes`)
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
      const orgId = faker.number.int();

      await request(app.getHttpServer())
        .delete(`/v1/organizations/${orgId}/safes`)
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
      const chain = chainBuilder().build();
      const orgId = faker.number.int();

      await request(app.getHttpServer())
        .delete(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          safes: [
            {
              chainId: chain.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        })
        .expect(404)
        .expect({
          statusCode: 404,
          message: 'User not found.',
          error: 'Not Found',
        });
    });

    it('Should return a 422 if body is an empty array', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const orgId = faker.number.int();

      await request(app.getHttpServer())
        .delete(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ safes: [] })
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'too_small',
          minimum: 1,
          type: 'array',
          inclusive: true,
          exact: false,
          message: 'Array must contain at least 1 element(s)',
          path: ['safes'],
        });
    });

    it('Should return a 422 if any of the chainIds is invalid', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const chain2 = chainBuilder().build();
      const orgId = faker.number.int();

      await request(app.getHttpServer())
        .delete(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          safes: [
            {
              chainId: 111,
              address: getAddress(faker.finance.ethereumAddress()),
            },
            {
              chainId: chain2.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        })
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['safes', 0, 'chainId'],
          message: 'Expected string, received number',
        });
    });

    it('Should return a 422 if any of the addresses is invalid', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const chain1 = chainBuilder().build();
      const chain2 = chainBuilder().build();
      const orgId = faker.number.int();

      await request(app.getHttpServer())
        .delete(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          safes: [
            {
              chainId: chain1.chainId,
              address: 'invalid-address',
            },
            {
              chainId: chain2.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        })
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'custom',
          message: 'Invalid address',
          path: ['safes', 0, 'address'],
        });
    });

    it('Should return a 422 if organization id is bigger than the max limit', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const chainIdMinLength = 79;
      const min = BigInt('1' + '0'.repeat(chainIdMinLength - 1));
      const max = BigInt('9'.repeat(chainIdMinLength));
      const chain1 = chainBuilder()
        .with('chainId', faker.number.bigInt({ min, max }).toString())
        .build();
      const chain2 = chainBuilder().build();
      const orgId = faker.string.alpha();

      await request(app.getHttpServer())
        .delete(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          safes: [
            {
              chainId: chain1.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
            },
            {
              chainId: chain2.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        })
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'custom',
          message: 'Value must be less than or euqal to 78',
          path: ['safes', 0, 'chainId'],
        });
    });

    it('Should return a 400 if organization id is invalid', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const chain1 = chainBuilder().build();
      const chain2 = chainBuilder().build();
      const orgId = faker.string.alpha();

      await request(app.getHttpServer())
        .delete(`/v1/organizations/${orgId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          safes: [
            {
              chainId: chain1.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
            },
            {
              chainId: chain2.chainId,
              address: getAddress(faker.finance.ethereumAddress()),
            },
          ],
        })
        .expect(400)
        .expect({
          message: 'Validation failed (numeric string is expected)',
          error: 'Bad Request',
          statusCode: 400,
        });
    });
  });
});
