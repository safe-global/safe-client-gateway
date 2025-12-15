import { type Server } from 'http';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import configuration from '@/config/entities/__tests__/configuration';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { AccountsDatasourceModule } from '@/modules/accounts/datasources/accounts.datasource.module';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { TestAccountsDataSourceModule } from '@/modules/accounts/datasources/__tests__/test.accounts.datasource.module';
import { TestNotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/test.notification.repository.module';
import { AddressBooksDatasourceModule } from '@/modules/accounts/datasources/address-books/address-books.datasource.module';
import { TestAddressBooksDataSourceModule } from '@/modules/accounts/datasources/address-books/__tests__/test.address-books.datasource.module';
import { CounterfactualSafesDatasourceModule } from '@/modules/accounts/datasources/counterfactual-safes/counterfactual-safes.datasource.module';
import { TestCounterfactualSafesDataSourceModule } from '@/modules/accounts/datasources/counterfactual-safes/__tests__/test.counterfactual-safes.datasource.module';
import { SpacesController } from '@/modules/spaces/routes/spaces.controller';
import { checkGuardIsApplied } from '@/__tests__/util/check-guard';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { authPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { faker } from '@faker-js/faker/.';
import { SpaceStatus } from '@/modules/spaces/domain/entities/space.entity';
import {
  MemberRole,
  MemberStatus,
} from '@/modules/users/domain/entities/member.entity';
import { UserStatus } from '@/modules/users/domain/entities/user.entity';
import { getEnumKey } from '@/domain/common/utils/enum';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { createTestModule } from '@/__tests__/testing-module';
import type { Address } from 'viem';

describe('SpacesController', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;

  async function initApp(args?: {
    maxSpaceCreationsPerUser?: number;
    rateLimit?: { max: number; windowSeconds: number };
  }): Promise<INestApplication<Server>> {
    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      spaces: {
        ...defaultConfiguration.spaces,
        maxSpaceCreationsPerUser:
          args?.maxSpaceCreationsPerUser ??
          defaultConfiguration.spaces.maxSpaceCreationsPerUser,
        rateLimit: {
          ...defaultConfiguration.spaces.rateLimit,
          creation: {
            ...(args?.rateLimit ??
              defaultConfiguration.spaces.rateLimit.creation),
          },
        },
      },
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

    const application = await new TestAppProvider().provide(moduleFixture);
    await application.init();
    return application;
  }

  beforeAll(async () => {
    jest.resetAllMocks();
    app = await initApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should require authentication for every endpoint', () => {
    const endpoints = Object.values(
      SpacesController.prototype,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    ) as Array<Function>;

    endpoints.forEach((fn) => checkGuardIsApplied(AuthGuard, fn));
  });

  describe('POST /v1/spaces', () => {
    it('Should create a space', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceName = nameBuilder();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: spaceName })
        .expect(201)
        .expect(({ body }) =>
          expect(body).toEqual({
            id: expect.any(Number),
            name: spaceName,
          }),
        );
    });

    it('Should rate limit creations', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const app = await initApp({ rateLimit: { max: 1, windowSeconds: 60 } });

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: nameBuilder() })
        .expect(201);

      // Second request, but rateLimit.max = 1
      await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: nameBuilder() })
        .expect(429)
        .expect('Rate limit reached');
    });

    it('should return a 403 if not authenticated', async () => {
      await request(app.getHttpServer()).post('/v1/spaces').expect(403).expect({
        statusCode: 403,
        message: 'Forbidden resource',
        error: 'Forbidden',
      });
    });

    it('Should return a 403 if the AuthPayload is empty', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as Address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('Should return a 403 if the MAX_SPACE_CREATIONS_PER_USER limit is reached', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const app = await initApp({ maxSpaceCreationsPerUser: 1 });

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      // maxSpaceCreationsPerUser = 1
      await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: nameBuilder() })
        .expect(201)
        .expect(({ body }) =>
          expect(body).toEqual({
            id: expect.any(Number),
            name: expect.any(String),
          }),
        );

      await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: nameBuilder() })
        .expect(403)
        .expect({
          message: 'User has reached the maximum number of Spaces.',
          error: 'Forbidden',
          statusCode: 403,
        });
    });

    it('Should return a 404 if user is not found', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceName = nameBuilder();

      await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: spaceName })
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
        .post('/v1/spaces')
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

  describe('POST /v1/spaces/create-with-user', () => {
    it('Should create a space when user exists', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceName = nameBuilder();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      await request(app.getHttpServer())
        .post('/v1/spaces/create-with-user')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: spaceName })
        .expect(201)
        .expect(({ body }) =>
          expect(body).toEqual({
            id: expect.any(Number),
            name: spaceName,
          }),
        );
    });

    it('Should create a space with user does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceName = nameBuilder();

      await request(app.getHttpServer())
        .post('/v1/spaces/create-with-user')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: spaceName })
        .expect(201)
        .expect(({ body }) =>
          expect(body).toEqual({
            id: expect.any(Number),
            name: spaceName,
          }),
        );
    });

    it('should return a 403 if not authenticated', async () => {
      await request(app.getHttpServer())
        .post('/v1/spaces/create-with-user')
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('Should return a 403 if the AuthPayload is empty', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as Address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/spaces/create-with-user')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('Should return a 422 if no name is provided', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post('/v1/spaces/create-with-user')
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

  describe('GET /spaces', () => {
    it('Should return a list of spaces', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const firstSpaceName = nameBuilder();
      const secondSpaceName = nameBuilder();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: firstSpaceName })
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: secondSpaceName })
        .expect(201);

      await request(app.getHttpServer())
        .get('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual([
            {
              id: expect.any(Number),
              name: firstSpaceName,
              status: getEnumKey(SpaceStatus, SpaceStatus.ACTIVE),
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
              members: [
                {
                  id: expect.any(Number),
                  name: expect.any(String),
                  alias: null,
                  invitedBy: null,
                  role: getEnumKey(MemberRole, MemberRole.ADMIN),
                  status: getEnumKey(SpaceStatus, SpaceStatus.ACTIVE),
                  createdAt: expect.any(String),
                  updatedAt: expect.any(String),
                  user: {
                    id: expect.any(Number),
                    status: getEnumKey(UserStatus, UserStatus.ACTIVE),
                    createdAt: expect.any(String),
                    updatedAt: expect.any(String),
                  },
                },
              ],
            },
            {
              id: expect.any(Number),
              name: secondSpaceName,
              status: getEnumKey(SpaceStatus, SpaceStatus.ACTIVE),
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
              members: [
                {
                  id: expect.any(Number),
                  name: expect.any(String),
                  alias: null,
                  invitedBy: null,
                  role: getEnumKey(MemberRole, MemberRole.ADMIN),
                  status: getEnumKey(MemberStatus, MemberStatus.ACTIVE),
                  createdAt: expect.any(String),
                  updatedAt: expect.any(String),
                  user: {
                    id: expect.any(Number),
                    status: getEnumKey(UserStatus, UserStatus.ACTIVE),
                    createdAt: expect.any(String),
                    updatedAt: expect.any(String),
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
        .get('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404)
        .expect({
          message: 'User not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('should return a 403 if not authenticated', async () => {
      await request(app.getHttpServer()).get('/v1/spaces').expect(403).expect({
        statusCode: 403,
        message: 'Forbidden resource',
        error: 'Forbidden',
      });
    });

    it('Should return a 403 is the AuthPayload is empty', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as Address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });
  });

  describe('GET /spaces/:id', () => {
    it('Should return a space by its id', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceName = nameBuilder();

      const createUserResponse = await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);
      const userId = createUserResponse.body.id;

      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: spaceName })
        .expect(201);
      const spaceId = createSpaceResponse.body.id;

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            id: spaceId,
            name: spaceName,
            status: getEnumKey(SpaceStatus, SpaceStatus.ACTIVE),
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
            members: [
              {
                id: expect.any(Number),
                name: expect.any(String),
                alias: null,
                invitedBy: null,
                status: getEnumKey(MemberStatus, MemberStatus.ACTIVE),
                role: getEnumKey(MemberRole, MemberRole.ADMIN),
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
                user: {
                  id: userId,
                  status: getEnumKey(UserStatus, UserStatus.ACTIVE),
                  createdAt: expect.any(String),
                  updatedAt: expect.any(String),
                },
              },
            ],
          });
        });
    });

    it('Should return a space by its id for an invited member', async () => {
      const adminAuthPayloadDto = authPayloadDtoBuilder().build();
      const adminAccessToken = jwtService.sign(adminAuthPayloadDto);
      const memberAuthPayloadDto = authPayloadDtoBuilder().build();
      const memberAccessToken = jwtService.sign(memberAuthPayloadDto);
      const spaceName = nameBuilder();

      const createUserResponse = await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .expect(201);
      const userId = createUserResponse.body.id;

      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({ name: spaceName })
        .expect(201);
      const spaceId = createSpaceResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              name: faker.person.firstName(),
              address: memberAuthPayloadDto.signer_address,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual(
            expect.objectContaining({
              id: spaceId,
              name: spaceName,
              status: getEnumKey(SpaceStatus, SpaceStatus.ACTIVE),
              members: expect.arrayContaining([
                expect.objectContaining({
                  invitedBy: null,
                  status: getEnumKey(MemberStatus, MemberStatus.ACTIVE),
                  role: getEnumKey(MemberRole, MemberRole.ADMIN),
                  user: expect.objectContaining({
                    id: userId,
                    status: getEnumKey(UserStatus, UserStatus.ACTIVE),
                  }),
                }),
                expect.objectContaining({
                  invitedBy: adminAuthPayloadDto.signer_address,
                  status: getEnumKey(MemberStatus, MemberStatus.INVITED),
                  role: getEnumKey(MemberRole, MemberRole.MEMBER),
                  user: expect.objectContaining({
                    status: getEnumKey(UserStatus, UserStatus.PENDING),
                  }),
                }),
              ]),
            }),
          );
        });
    });

    it('Should return a 404 if the user declined the membership', async () => {
      const adminAuthPayloadDto = authPayloadDtoBuilder().build();
      const adminAccessToken = jwtService.sign(adminAuthPayloadDto);
      const memberAuthPayloadDto = authPayloadDtoBuilder().build();
      const memberAccessToken = jwtService.sign(memberAuthPayloadDto);
      const spaceName = nameBuilder();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .expect(201);

      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({ name: spaceName })
        .expect(201);
      const spaceId = createSpaceResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              name: faker.person.firstName(),
              address: memberAuthPayloadDto.signer_address,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/decline`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .expect(201)
        .expect({});

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .expect(404)
        .expect({
          statusCode: 404,
          message: 'Space not found.',
          error: 'Not Found',
        });
    });

    it('Should return a 404 if a space id does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceId = faker.number.int({ min: 10000, max: 20000 });

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404)
        .expect({
          statusCode: 404,
          message: 'Space not found.',
          error: 'Not Found',
        });
    });

    it('Should return a 404 if the user does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceId = faker.number.int({ min: 10000, max: 20000 });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404)
        .expect({
          statusCode: 404,
          message: 'User not found.',
          error: 'Not Found',
        });
    });

    it('should return a 403 if not authenticated', async () => {
      await request(app.getHttpServer()).get('/v1/spaces').expect(403).expect({
        statusCode: 403,
        message: 'Forbidden resource',
        error: 'Forbidden',
      });
    });

    it('Should return a 403 is the AuthPayload is empty', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as Address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });
  });

  describe('PATCH /spaces/:id', () => {
    it('Should update a space', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const previousSpaceName = nameBuilder();
      const newSpaceName = nameBuilder();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: previousSpaceName });

      const spaceId = createSpaceResponse.body.id;

      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          name: newSpaceName,
          status: getEnumKey(SpaceStatus, SpaceStatus.ACTIVE),
        })
        .expect(200)
        .expect(({ body }) =>
          expect(body).toEqual({
            id: spaceId,
          }),
        );
    });

    it('should return a 403 if not authenticated', async () => {
      const spaceId = faker.number.int({ min: 900000, max: 990000 });

      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}`)
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('Should return a 403 is the AuthPayload is empty', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as Address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceId = faker.number.int({ min: 1 });

      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('Should throw a 401 if user can not update a space because the space does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceName = nameBuilder();
      const spaceId = faker.number.int({ min: 900000, max: 990000 });

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          name: spaceName,
          status: getEnumKey(SpaceStatus, SpaceStatus.ACTIVE),
        })
        .expect(401)
        .expect(({ body }) =>
          expect(body).toEqual({
            statusCode: 401,
            error: 'Unauthorized',
            message:
              'User is unauthorized. signer_address= ' +
              authPayloadDto.signer_address,
          }),
        );
    });

    it('Should throw a 401 if a member of the space does not have access to update a space', async () => {
      const adminAuthPayloadDto = authPayloadDtoBuilder().build();
      const adminAccessToken = jwtService.sign(adminAuthPayloadDto);
      const memberAuthPayloadDto = authPayloadDtoBuilder().build();
      const memberAccessToken = jwtService.sign(memberAuthPayloadDto);
      const previousSpaceName = nameBuilder();
      const newSpaceName = nameBuilder();
      const memberName = nameBuilder();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${adminAccessToken}`]);

      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({ name: previousSpaceName });
      const spaceId = createSpaceResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              name: memberName,
              address: memberAuthPayloadDto.signer_address,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({
          name: newSpaceName,
          status: getEnumKey(SpaceStatus, SpaceStatus.ACTIVE),
        })
        .expect(401)
        .expect({
          statusCode: 401,
          error: 'Unauthorized',
          message:
            'User is unauthorized. signer_address= ' +
            memberAuthPayloadDto.signer_address,
        });
    });
    it('Should throw a 401 if a an inactive admin tries to update the space', async () => {
      const activeAdminAuthPayloadDto = authPayloadDtoBuilder().build();
      const activeAdminAccessToken = jwtService.sign(activeAdminAuthPayloadDto);
      const inactiveAdminAuthPayloadDto = authPayloadDtoBuilder().build();
      const inactiveAdminAccessToken = jwtService.sign(
        inactiveAdminAuthPayloadDto,
      );
      const previousSpaceName = nameBuilder();
      const newSpaceName = nameBuilder();
      const memberName = nameBuilder();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${activeAdminAccessToken}`]);

      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${activeAdminAccessToken}`])
        .send({ name: previousSpaceName });
      const spaceId = createSpaceResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${activeAdminAccessToken}`])
        .send({
          users: [
            {
              role: 'ADMIN',
              name: memberName,
              address: inactiveAdminAuthPayloadDto.signer_address,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}`)
        .set('Cookie', [`access_token=${inactiveAdminAccessToken}`])
        .send({
          name: newSpaceName,
          status: getEnumKey(SpaceStatus, SpaceStatus.ACTIVE),
        })
        .expect(401)
        .expect({
          statusCode: 401,
          error: 'Unauthorized',
          message:
            'User is unauthorized. signer_address= ' +
            inactiveAdminAuthPayloadDto.signer_address,
        });
    });

    it('Should throw a 401 if user does not have access to update a space', async () => {
      const adminAuthPayloadDto = authPayloadDtoBuilder().build();
      const adminAccessToken = jwtService.sign(adminAuthPayloadDto);
      const nonMemberAuthPayloadDto = authPayloadDtoBuilder().build();
      const nonMemberAccessToken = jwtService.sign(nonMemberAuthPayloadDto);
      const previousSpaceName = nameBuilder();
      const newSpaceName = nameBuilder();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${adminAccessToken}`]);
      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${nonMemberAccessToken}`]);

      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({ name: previousSpaceName });
      const spaceId = createSpaceResponse.body.id;

      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}`)
        .set('Cookie', [`access_token=${nonMemberAccessToken}`])
        .send({
          name: newSpaceName,
          status: getEnumKey(SpaceStatus, SpaceStatus.ACTIVE),
        })
        .expect(401)
        .expect({
          statusCode: 401,
          error: 'Unauthorized',
          message:
            'User is unauthorized. signer_address= ' +
            nonMemberAuthPayloadDto.signer_address,
        });
    });
  });

  describe('DELETE /spaces/:id', () => {
    it('Should delete a space', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceName = nameBuilder();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: spaceName });

      const spaceId = createSpaceResponse.body.id;

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(204);
    });

    it('Should throw a 401 if user can not update a space because the space does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceName = nameBuilder();
      const spaceId = faker.number.int({ min: 900000, max: 990000 });

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`]);

      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          name: spaceName,
          status: getEnumKey(SpaceStatus, SpaceStatus.ACTIVE),
        })
        .expect(401)
        .expect(({ body }) =>
          expect(body).toEqual({
            statusCode: 401,
            error: 'Unauthorized',
            message:
              'User is unauthorized. signer_address= ' +
              authPayloadDto.signer_address,
          }),
        );
    });

    it('Should throw a 401 if a member of the space does not have access to delete a space', async () => {
      const adminAuthPayloadDto = authPayloadDtoBuilder().build();
      const adminAccessToken = jwtService.sign(adminAuthPayloadDto);
      const memberAuthPayloadDto = authPayloadDtoBuilder().build();
      const memberAccessToken = jwtService.sign(memberAuthPayloadDto);
      const spaceName = nameBuilder();
      const memberName = nameBuilder();

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
              role: 'MEMBER',
              address: memberAuthPayloadDto.signer_address,
              name: memberName,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .expect(401)
        .expect({
          statusCode: 401,
          error: 'Unauthorized',
          message:
            'User is unauthorized. signer_address= ' +
            memberAuthPayloadDto.signer_address,
        });
    });

    it('Should throw a 401 if an inactive admin tries to delete the space', async () => {
      const activeAdminAuthPayloadDto = authPayloadDtoBuilder().build();
      const activeAdminAccessToken = jwtService.sign(activeAdminAuthPayloadDto);
      const inactiveAdminAuthPayloadDto = authPayloadDtoBuilder().build();
      const inactiveAdminAccessToken = jwtService.sign(
        inactiveAdminAuthPayloadDto,
      );
      const spaceName = nameBuilder();
      const memberName = nameBuilder();

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
              role: 'ADMIN',
              address: inactiveAdminAuthPayloadDto.signer_address,
              name: memberName,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}`)
        .set('Cookie', [`access_token=${inactiveAdminAccessToken}`])
        .expect(401)
        .expect({
          statusCode: 401,
          error: 'Unauthorized',
          message:
            'User is unauthorized. signer_address= ' +
            inactiveAdminAuthPayloadDto.signer_address,
        });
    });

    it('Should throw a 401 if user does not have access to delete a space', async () => {
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
        .delete(`/v1/spaces/${spaceId}`)
        .set('Cookie', [`access_token=${nonMemberAccessToken}`])
        .expect(401)
        .expect({
          statusCode: 401,
          error: 'Unauthorized',
          message:
            'User is unauthorized. signer_address= ' +
            nonMemberAuthPayloadDto.signer_address,
        });
    });

    it('Should return a 403 is the AuthPayload is empty', async () => {
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as Address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceId = faker.number.int({ min: 1 });

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('should return a 403 if not authenticated', async () => {
      const spaceId = faker.number.int({ min: 900000, max: 990000 });

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}`)
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });
  });
});
