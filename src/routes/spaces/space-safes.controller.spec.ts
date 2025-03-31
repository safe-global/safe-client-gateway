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
import { SpaceSafesController } from '@/routes/spaces/space-safes.controller';
import { checkGuardIsApplied } from '@/__tests__/util/check-guard';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { faker } from '@faker-js/faker/.';
import { getAddress } from 'viem';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { nameBuilder } from '@/domain/common/entities/name.builder';

describe('SpaceSafesController', () => {
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
      SpaceSafesController.prototype,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    ) as Array<Function>;

    endpoints.forEach((fn) => checkGuardIsApplied(AuthGuard, fn));
  });

  describe('POST /v1/spaces/:spaceId/safes', () => {
    it('Should create a new space safe', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceName = nameBuilder();
      const chain = chainBuilder().build();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: spaceName });
      const spaceId = createSpaceResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
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

    it('Should create multiple new space safes', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceName = nameBuilder();
      const chain1 = chainBuilder().build();
      const chain2 = chainBuilder().build();
      const chain3 = chainBuilder().build();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: spaceName });
      const spaceId = createSpaceResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
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

    it('Should fail on duplicate space safes', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceName = nameBuilder();
      const chain1 = chainBuilder().build();
      const chain2 = chainBuilder().build();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: spaceName });
      const spaceId = createSpaceResponse.body.id;
      const spaceSafe1 = {
        chainId: chain1.chainId,
        address: getAddress(faker.finance.ethereumAddress()),
      };
      const spaceSafe2 = {
        chainId: chain2.chainId,
        address: getAddress(faker.finance.ethereumAddress()),
      };
      const duplicatedSpaceSafe = {
        chainId: spaceSafe1.chainId,
        address: spaceSafe1.address,
      };

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          safes: [spaceSafe1, spaceSafe2, duplicatedSpaceSafe],
        })
        .expect(409)
        .expect({
          message: `A SpaceSafe with the same chainId and address already exists: Key (chain_id, address, space_id)=(${duplicatedSpaceSafe.chainId}, ${duplicatedSpaceSafe.address}, ${spaceId}) already exists.`,
          error: 'Conflict',
          statusCode: 409,
        });
    });

    it('Should allow multiple spaces to add the same Safe', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceName = nameBuilder();
      const space2Name = faker.company.name();
      const chain1 = chainBuilder().build();
      const chain2 = chainBuilder().build();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: spaceName });
      const createSpace2Response = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: space2Name });
      const spaceId = createSpaceResponse.body.id;
      const space2Id = createSpace2Response.body.id;
      const spaceSafe1 = {
        chainId: chain1.chainId,
        address: getAddress(faker.finance.ethereumAddress()),
      };
      const spaceSafe2 = {
        chainId: chain2.chainId,
        address: getAddress(faker.finance.ethereumAddress()),
      };
      const spaceSafe3 = {
        chainId: chain2.chainId,
        address: getAddress(faker.finance.ethereumAddress()),
      };

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          safes: [spaceSafe1, spaceSafe2],
        })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/v1/spaces/${space2Id}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          safes: [spaceSafe2, spaceSafe3], // spaceSafe2 is shared between space1 and space2
        })
        .expect(201);
    });

    it('Should return a 401 if user is not authorized', async () => {
      const adminAuthPayloadDto = authPayloadDtoBuilder().build();
      const adminAccessToken = jwtService.sign(adminAuthPayloadDto);
      const userAuthPayloadDto = authPayloadDtoBuilder().build();
      const userAccessToken = jwtService.sign(userAuthPayloadDto);
      const spaceName = nameBuilder();
      const chain = chainBuilder().build();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${adminAccessToken}`]);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${userAccessToken}`]);

      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({ name: spaceName });
      const spaceId = createSpaceResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
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

    it('Should return a 401 for an inactive admin', async () => {
      const activeAdminAuthPayloadDto = authPayloadDtoBuilder().build();
      const inactiveAdminAuthPayload = authPayloadDtoBuilder().build();
      const activeAdminAccessToken = jwtService.sign(activeAdminAuthPayloadDto);
      const inactiveAdminAccessToken = jwtService.sign(
        inactiveAdminAuthPayload,
      );
      const spaceName = nameBuilder();
      const chain = chainBuilder().build();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${activeAdminAccessToken}`]);

      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${activeAdminAccessToken}`])
        .send({ name: spaceName });
      const spaceId = createSpaceResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${activeAdminAccessToken}`])
        .send({
          users: [
            {
              address: getAddress(inactiveAdminAuthPayload.signer_address),
              name: faker.person.firstName(),
              role: 'ADMIN', // Admin role, but not active
            },
          ],
        });

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${inactiveAdminAccessToken}`])
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
            inactiveAdminAuthPayload.signer_address,
          statusCode: 401,
        });
    });

    it('Should return a 401 for a MEMBER of a space', async () => {
      const adminAuthPayloadDto = authPayloadDtoBuilder().build();
      const adminAccessToken = jwtService.sign(adminAuthPayloadDto);
      const memberAuthPayloadDto = authPayloadDtoBuilder().build();
      const memberAccessToken = jwtService.sign(memberAuthPayloadDto);
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const chain = chainBuilder().build();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${adminAccessToken}`]);

      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({ name: spaceName });
      const spaceId = createSpaceResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({
          users: [
            {
              address: getAddress(memberAuthPayloadDto.signer_address),
              name: memberName,
              role: 'MEMBER',
            },
          ],
        });

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/accept`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send();

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
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
      const spaceId = faker.number.int();
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
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
      const spaceId = faker.number.int();

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
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
      const spaceId = faker.number.int();

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
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
      const spaceId = faker.number.int();

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
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
      const spaceId = faker.number.int();

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
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
      const spaceId = faker.number.int();

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
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

    it('Should return a 422 if space id is bigger than the max limit', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const chainIdMinLength = 79;
      const min = BigInt('1' + '0'.repeat(chainIdMinLength - 1));
      const max = BigInt('9'.repeat(chainIdMinLength));
      const chain1 = chainBuilder()
        .with('chainId', faker.number.bigInt({ min, max }).toString())
        .build();
      const chain2 = chainBuilder().build();
      const spaceId = faker.string.alpha();

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
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

    it('Should return a 400 if space id is invalid', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const chain1 = chainBuilder().build();
      const chain2 = chainBuilder().build();
      const spaceId = faker.string.alpha();

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
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

  describe('GET /spaces/:spaceId/safes', () => {
    it('Should return a list of space safes if the user is an admin', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceName = nameBuilder();
      const chain1 = chainBuilder()
        .with('chainId', faker.string.numeric({ length: { min: 1, max: 2 } }))
        .build();
      const chain2 = chainBuilder()
        .with('chainId', faker.string.numeric({ length: { min: 3, max: 4 } }))
        .build();
      const createSpaceSafePayload = {
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

      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: spaceName });
      const spaceId = createSpaceResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(createSpaceSafePayload);

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({
          safes: {
            [chain1.chainId]: [createSpaceSafePayload.safes[0].address],
            [chain2.chainId]: [
              createSpaceSafePayload.safes[1].address,
              createSpaceSafePayload.safes[2].address,
            ],
          },
        });
    });

    it('Should return a list of space safes if the user is a member', async () => {
      const adminAuthPayloadDto = authPayloadDtoBuilder().build();
      const memberAuthPayloadDto = authPayloadDtoBuilder().build();
      const adminAccessToken = jwtService.sign(adminAuthPayloadDto);
      const memberAccessToken = jwtService.sign(memberAuthPayloadDto);
      const spaceName = nameBuilder();
      const chain1 = chainBuilder()
        .with('chainId', faker.string.numeric({ length: { min: 1, max: 2 } }))
        .build();
      const chain2 = chainBuilder()
        .with('chainId', faker.string.numeric({ length: { min: 3, max: 4 } }))
        .build();
      const createSpaceSafePayload = {
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

      // Create the admin user and the wallet
      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${adminAccessToken}`]);

      // Create the space
      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({ name: spaceName });
      const spaceId = createSpaceResponse.body.id;

      // Create the member user and the wallet
      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .expect(201)
        .expect(({ body }) =>
          expect(body).toEqual({
            id: expect.any(Number),
          }),
        );

      // Invite the member user
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({
          users: [
            {
              address: memberAuthPayloadDto.signer_address,
              name: faker.person.firstName(),
              role: 'MEMBER',
            },
          ],
        });

      // Accept the invite
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/accept`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({
          name: faker.person.firstName(),
        });

      // Create the safes
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send(createSpaceSafePayload);

      // Get the safes as a member
      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .expect(200)
        .expect({
          safes: {
            [chain1.chainId]: [createSpaceSafePayload.safes[0].address],
            [chain2.chainId]: [
              createSpaceSafePayload.safes[1].address,
              createSpaceSafePayload.safes[2].address,
            ],
          },
        });
    });

    it('Should return a 401 if user is not a member', async () => {
      const adminAuthPayloadDto = authPayloadDtoBuilder().build();
      const adminAccessToken = jwtService.sign(adminAuthPayloadDto);
      const userAuthPayloadDto = authPayloadDtoBuilder().build();
      const userAccessToken = jwtService.sign(userAuthPayloadDto);
      const spaceName = nameBuilder();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${adminAccessToken}`]);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${userAccessToken}`]);

      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({ name: spaceName });
      const spaceId = createSpaceResponse.body.id;

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/safes`)
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

    it('Should return a 401 if user is not an active or invited member', async () => {
      const adminAuthPayloadDto = authPayloadDtoBuilder().build();
      const adminAccessToken = jwtService.sign(adminAuthPayloadDto);
      const nonMemberAuthPayloadDto = authPayloadDtoBuilder().build();
      const nonMemberAccessToken = jwtService.sign(nonMemberAuthPayloadDto);
      const spaceName = nameBuilder();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${adminAccessToken}`]);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${nonMemberAccessToken}`]);

      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({ name: spaceName });
      const spaceId = createSpaceResponse.body.id;

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${nonMemberAccessToken}`])
        .expect(401)
        .expect({
          error: 'Unauthorized',
          message:
            'User is unauthorized. signer_address= ' +
            nonMemberAuthPayloadDto.signer_address,
          statusCode: 401,
        });
    });

    it('should return a 403 if not authenticated', async () => {
      const spaceId = faker.number.int();
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
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
      const spaceId = faker.number.int();

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/safes`)
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
      const spaceId = faker.number.int();

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404)
        .expect({
          statusCode: 404,
          message: 'User not found.',
          error: 'Not Found',
        });
    });

    it('Should return a 400 if space id is invalid', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceId = faker.string.alpha();

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(400)
        .expect({
          message: 'Validation failed (numeric string is expected)',
          error: 'Bad Request',
          statusCode: 400,
        });
    });
  });

  describe('DELETE /v1/spaces/:spaceId/safes', () => {
    it('Should delete a space safe', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceName = nameBuilder();
      const chain = chainBuilder().build();
      const spaceSafes = {
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

      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: spaceName });
      const spaceId = createSpaceResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(spaceSafes);

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(spaceSafes)
        .expect(204);
    });

    it('Should delete multiple space safes', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceName = nameBuilder();
      const chain1 = chainBuilder().build();
      const chain2 = chainBuilder().build();
      const chain3 = chainBuilder().build();
      const spaceSafes = {
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

      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: spaceName });
      const spaceId = createSpaceResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(spaceSafes);

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(spaceSafes)
        .expect(204);
    });

    it('Should return a 401 if user is not authorized', async () => {
      const adminAuthPayloadDto = authPayloadDtoBuilder().build();
      const adminAccessToken = jwtService.sign(adminAuthPayloadDto);
      const userAuthPayloadDto = authPayloadDtoBuilder().build();
      const userAccessToken = jwtService.sign(userAuthPayloadDto);
      const spaceName = nameBuilder();
      const chain1 = chainBuilder().build();
      const chain2 = chainBuilder().build();
      const chain3 = chainBuilder().build();
      const spaceSafes = {
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

      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({ name: spaceName });
      const spaceId = createSpaceResponse.body.id;

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send(spaceSafes);

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${userAccessToken}`])
        .send(spaceSafes)
        .expect(401)
        .expect({
          error: 'Unauthorized',
          message:
            'User is unauthorized. signer_address= ' +
            userAuthPayloadDto.signer_address,
          statusCode: 401,
        });
    });

    it('should fail if the user is not an admin', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceName = nameBuilder();
      const chain = chainBuilder().build();
      const spaceSafes = {
        safes: [
          {
            chainId: chain.chainId,
            address: getAddress(faker.finance.ethereumAddress()),
          },
        ],
      };
      const memberAuthPayloadDto = authPayloadDtoBuilder().build();
      const memberAccessToken = jwtService.sign(memberAuthPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: spaceName });
      const spaceId = createSpaceResponse.body.id;

      // Invite the member user
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              address: getAddress(memberAuthPayloadDto.signer_address),
              name: faker.person.firstName(),
              role: 'MEMBER',
            },
          ],
        });
      // Accept the invite
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/accept`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({
          name: faker.person.firstName(),
        });

      // Create the Safe with the admin
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(spaceSafes);

      // Try to delete the Safe with the member
      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send(spaceSafes)
        .expect(401)
        .expect({
          message: `User is unauthorized. signer_address= ${memberAuthPayloadDto.signer_address}`,
          error: 'Unauthorized',
          statusCode: 401,
        });
    });

    it('Should return a 401 for an inactive admin', async () => {
      const activeAdminAuthPayloadDto = authPayloadDtoBuilder().build();
      const inactiveAdminAuthPayload = authPayloadDtoBuilder().build();
      const activeAdminAccessToken = jwtService.sign(activeAdminAuthPayloadDto);
      const inactiveAdminAccessToken = jwtService.sign(
        inactiveAdminAuthPayload,
      );
      const spaceName = nameBuilder();
      const chain = chainBuilder().build();
      const spaceSafes = {
        safes: [
          {
            chainId: chain.chainId,
            address: getAddress(faker.finance.ethereumAddress()),
          },
        ],
      };

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${activeAdminAccessToken}`]);

      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${activeAdminAccessToken}`])
        .send({ name: spaceName });
      const spaceId = createSpaceResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${activeAdminAccessToken}`])
        .send({
          users: [
            {
              address: getAddress(inactiveAdminAuthPayload.signer_address),
              name: faker.person.firstName(),
              role: 'ADMIN', // Admin role, but not active
            },
          ],
        });

      // Create the space Safes with the active admin
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${activeAdminAccessToken}`])
        .send(spaceSafes)
        .expect(201);

      // Try to delete the space Safes with the inactive admin
      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${inactiveAdminAccessToken}`])
        .send(spaceSafes)
        .expect(401)
        .expect({
          message: `User is unauthorized. signer_address= ${inactiveAdminAuthPayload.signer_address}`,
          error: 'Unauthorized',
          statusCode: 401,
        });
    });

    it('should return a 403 if not authenticated', async () => {
      const spaceId = faker.number.int();
      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/safes`)
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
      const spaceId = faker.number.int();

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/safes`)
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
      const spaceId = faker.number.int();

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/safes`)
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
      const spaceId = faker.number.int();

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/safes`)
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
      const spaceId = faker.number.int();

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/safes`)
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
      const spaceId = faker.number.int();

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/safes`)
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

    it('Should return a 422 if space id is bigger than the max limit', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const chainIdMinLength = 79;
      const min = BigInt('1' + '0'.repeat(chainIdMinLength - 1));
      const max = BigInt('9'.repeat(chainIdMinLength));
      const chain1 = chainBuilder()
        .with('chainId', faker.number.bigInt({ min, max }).toString())
        .build();
      const chain2 = chainBuilder().build();
      const spaceId = faker.string.alpha();

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/safes`)
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

    it('Should return a 400 if space id is invalid', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const chain1 = chainBuilder().build();
      const chain2 = chainBuilder().build();
      const spaceId = faker.string.alpha();

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/safes`)
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
