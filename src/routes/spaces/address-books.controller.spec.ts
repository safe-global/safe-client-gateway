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
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { NotificationsRepositoryV2Module } from '@/domain/notifications/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/domain/notifications/v2/test.notification.repository.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'net';
import request from 'supertest';
import { getAddress } from 'viem';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { addressBookItemBuilder } from '@/domain/spaces/address-books/entities/__tests__/address-book-item.db.builder';

describe('AddressBooksController', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;

  const defaultConfiguration = configuration();

  async function initApp(args?: {
    maxUpsertionsPerUser?: number;
    rateLimit?: {
      max: number;
      windowSeconds: number;
    };
  }): Promise<INestApplication<Server>> {
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      spaces: {
        ...defaultConfiguration.spaces,
        addressBooks: {
          ...defaultConfiguration.spaces.addressBooks,
          maxItems:
            args?.maxUpsertionsPerUser ??
            defaultConfiguration.spaces.addressBooks.maxItems,
        },
        rateLimit: {
          ...defaultConfiguration.spaces.rateLimit,
          addressBookUpsertion: {
            ...(args?.rateLimit ??
              defaultConfiguration.spaces.rateLimit.addressBookUpsertion),
          },
        },
      },
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
    return app;
  }

  beforeAll(async () => {
    jest.resetAllMocks();
    app = await initApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /spaces/:spaceId/address-book', () => {
    it('should get an empty Space Address Book as admin', async () => {
      const { spaceId, accessToken } = await createSpace();

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({
          spaceId: spaceId.toString(),
          data: [],
        });
    });

    it('should get an empty Space Address Book as member', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await inviteMember({
        spaceId,
        adminAccessToken: accessToken,
      });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .expect(200)
        .expect({
          spaceId: spaceId.toString(),
          data: [],
        });
    });

    it('should get a Space Address Book with items as admin', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { mockName, mockAddress, mockChainIds } =
        await createAddressBookItem({
          spaceId,
          adminAccessToken: accessToken,
        });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) =>
          expect(body).toEqual({
            spaceId: spaceId.toString(),
            data: [
              {
                chainIds: mockChainIds,
                address: mockAddress,
                name: mockName,
                createdBy: expect.any(String),
                lastUpdatedBy: expect.any(String),
              },
            ],
          }),
        );
    });

    it('should get a Space Address Book with items as member', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await inviteMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const { mockName, mockAddress, mockChainIds } =
        await createAddressBookItem({
          spaceId,
          adminAccessToken: accessToken,
        });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .expect(200)
        .expect(({ body }) =>
          expect(body).toEqual({
            spaceId: spaceId.toString(),
            data: [
              {
                chainIds: mockChainIds,
                address: mockAddress,
                name: mockName,
                createdBy: expect.any(String),
                lastUpdatedBy: expect.any(String),
              },
            ],
          }),
        );
    });

    it('should return a 404 if the user declined the membership', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await inviteMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/decline`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .expect(404)
        .expect({
          statusCode: 404,
          message: 'Space not found.',
          error: 'Not Found',
        });
    });

    it('should return a 404 if a space id does not exist', async () => {
      const { accessToken } = await createSpace();

      await request(app.getHttpServer())
        .get(`/v1/spaces/${faker.string.numeric()}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404)
        .expect({
          statusCode: 404,
          message: 'Space not found.',
          error: 'Not Found',
        });
    });

    it('should return a 404 if the user does not exist', async () => {
      const { spaceId } = await createSpace();
      const authPayloadDto = authPayloadDtoBuilder().build();
      const nonExistentUserAccessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${nonExistentUserAccessToken}`])
        .expect(404)
        .expect({
          statusCode: 404,
          message: 'User not found.',
          error: 'Not Found',
        });
    });

    it('should return a 403 if not authenticated', async () => {
      const { spaceId } = await createSpace();

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${faker.string.sample()}`])
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('should return a 403 if the AuthPayload is empty', async () => {
      const { spaceId } = await createSpace();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', undefined as unknown as `0x${string}`)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });
  });

  describe('PUT /spaces/:spaceId/address-book', () => {
    it('should add Space Address Book Items', async () => {
      const { spaceId, accessToken } = await createSpace();
      const mockAddress = getAddress(faker.finance.ethereumAddress());
      const mockName = nameBuilder();
      const mockChainIds = faker.helpers.multiple(
        () => faker.string.numeric(),
        {
          count: { min: 1, max: 5 },
        },
      );

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          items: [
            {
              name: mockName,
              address: mockAddress,
              chainIds: mockChainIds,
            },
          ],
        })
        .expect(200)
        .expect(({ body }) =>
          expect(body).toEqual({
            spaceId: spaceId.toString(),
            data: [
              {
                chainIds: mockChainIds,
                address: mockAddress,
                name: mockName,
                createdBy: expect.any(String),
                lastUpdatedBy: expect.any(String),
              },
            ],
          }),
        );
    });

    it('should update Space Address Book Items', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { mockName, mockAddress, mockChainIds } =
        await createAddressBookItem({
          spaceId,
          adminAccessToken: accessToken,
        });

      const getAddressBookResponse = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) =>
          expect(body).toEqual({
            spaceId: spaceId.toString(),
            data: [
              {
                chainIds: mockChainIds,
                address: mockAddress,
                name: mockName,
                createdBy: expect.any(String),
                lastUpdatedBy: expect.any(String),
              },
            ],
          }),
        );

      expect(getAddressBookResponse.body.data.length).toEqual(1);

      const mockNewName = nameBuilder();
      const getAddressBookResponseAfterUpdate = await request(
        app.getHttpServer(),
      )
        .put(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          items: [
            {
              name: mockNewName,
              address: mockAddress,
              chainIds: mockChainIds,
            },
          ],
        })
        .expect(200)
        .expect(({ body }) =>
          expect(body).toEqual({
            spaceId: spaceId.toString(),
            data: [
              {
                chainIds: mockChainIds,
                address: mockAddress,
                name: mockNewName,
                createdBy: expect.any(String),
                lastUpdatedBy: expect.any(String),
              },
            ],
          }),
        );

      expect(getAddressBookResponseAfterUpdate.body.data.length).toEqual(1);
    });

    it('should add and update Space Address Book Items', async () => {
      const { spaceId, accessToken } = await createSpace();

      const firstItem = {
        name: nameBuilder(),
        address: getAddress(faker.finance.ethereumAddress()),
        chainIds: faker.helpers.multiple(() => faker.string.numeric(), {
          count: { min: 1, max: 5 },
        }),
      };

      const secondItem = {
        name: nameBuilder(),
        address: getAddress(faker.finance.ethereumAddress()),
        chainIds: faker.helpers.multiple(() => faker.string.numeric(), {
          count: { min: 1, max: 5 },
        }),
      };

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ items: [firstItem, secondItem] })
        .expect(200);

      const updatedFirstItem = {
        ...firstItem,
        name: nameBuilder(),
      };

      const { body: afterUpdateBody } = await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ items: [updatedFirstItem, secondItem] })
        .expect(200)
        .expect(({ body }) =>
          expect(body).toEqual({
            spaceId: spaceId.toString(),
            data: expect.arrayContaining([
              {
                ...updatedFirstItem,
                createdBy: expect.any(String),
                lastUpdatedBy: expect.any(String),
              },
              {
                ...secondItem,
                createdBy: expect.any(String),
                lastUpdatedBy: expect.any(String),
              },
            ]),
          }),
        );

      expect(afterUpdateBody.data.length).toBe(2);
    });

    it('should rate limit upsertions', async () => {
      const app = await initApp({ rateLimit: { max: 1, windowSeconds: 60 } });
      const { spaceId, accessToken } = await createSpace();
      const addressBookItem1 = addressBookItemBuilder().build();
      const addressBookItem2 = addressBookItemBuilder().build();

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          items: [
            {
              name: addressBookItem1.name,
              address: addressBookItem1.address,
              chainIds: addressBookItem1.chainIds,
            },
          ],
        })
        .expect(200);

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          items: [
            {
              name: addressBookItem2.name,
              address: addressBookItem2.address,
              chainIds: addressBookItem2.chainIds,
            },
          ],
        })
        .expect(429)
        .expect('Rate limit reached');
    });

    it('should return a 400 if the limit is reached', async () => {
      const app = await initApp({ maxUpsertionsPerUser: 1 });
      const { spaceId, accessToken } = await createSpace();
      const addressBookItem1 = addressBookItemBuilder().build();
      const addressBookItem2 = addressBookItemBuilder().build();

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          items: [
            {
              name: addressBookItem1.name,
              address: addressBookItem1.address,
              chainIds: addressBookItem1.chainIds,
            },
          ],
        })
        .expect(200);

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          items: [
            {
              name: addressBookItem2.name,
              address: addressBookItem2.address,
              chainIds: addressBookItem2.chainIds,
            },
          ],
        })
        .expect(400)
        .expect({
          message:
            'This Space only allows a maximum of 1 Address Book Items. You can only add up to 0 more.',
          error: 'Bad Request',
          statusCode: 400,
        });
    });

    it('should return a 400 if the request has more than the limit', async () => {
      const app = await initApp({ maxUpsertionsPerUser: 1 });
      const { spaceId, accessToken } = await createSpace();
      const addressBookItem1 = addressBookItemBuilder().build();
      const addressBookItem2 = addressBookItemBuilder().build();

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          items: [
            {
              name: addressBookItem1.name,
              address: addressBookItem1.address,
              chainIds: addressBookItem1.chainIds,
            },
            {
              name: addressBookItem2.name,
              address: addressBookItem2.address,
              chainIds: addressBookItem2.chainIds,
            },
          ],
        })
        .expect(400)
        .expect({
          message:
            'This Space only allows a maximum of 1 Address Book Items. You can only add up to 1 more.',
          error: 'Bad Request',
          statusCode: 400,
        });
    });

    it('should return a 404 if a space id does not exist', async () => {
      const { accessToken } = await createSpace();
      const nonExistingSpaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await request(app.getHttpServer())
        .put(`/v1/spaces/${nonExistingSpaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ items: [] })
        .expect(404);
    });

    it('should return a 404 if the user does not exist', async () => {
      const { spaceId } = await createSpace();
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ items: [] })
        .expect(404);
    });

    it('should return a 403 if not authenticated', async () => {
      const { spaceId } = await createSpace();

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book`)
        .send({ items: [] })
        .expect(403);
    });

    it('should return a 404 if the member is not an admin', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await inviteMember({
        spaceId,
        adminAccessToken: accessToken,
      });

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({ items: [] })
        .expect(404);
    });

    it('should return a 403 if the AuthPayload is empty', async () => {
      const { spaceId } = await createSpace();

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=`])
        .send({ items: [] })
        .expect(403);
    });

    it.todo('should return a 403 is the maximum number of items is reached');
  });

  describe('DELETE /spaces/:spaceId/address-book/:address', () => {
    it('should delete a Space address book item', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { mockAddress } = await createAddressBookItem({
        spaceId,
        adminAccessToken: accessToken,
      });

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/address-book/${mockAddress}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) =>
          expect(body).toEqual({
            spaceId: spaceId.toString(),
            data: [],
          }),
        );
    });

    it('should not delete the same address from a different Space', async () => {
      const { spaceId: spaceId1, accessToken: accessToken1 } =
        await createSpace();
      const { spaceId: spaceId2, accessToken: accessToken2 } =
        await createSpace();
      const authPayload2 = jwtService.decode(accessToken2) as AuthPayload;
      const { mockAddress } = await createAddressBookItem({
        spaceId: spaceId1,
        adminAccessToken: accessToken1,
      });
      const { mockName, mockChainIds } = await createAddressBookItem({
        spaceId: spaceId2,
        adminAccessToken: accessToken2,
        address: mockAddress,
      });

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId1}/address-book/${mockAddress}`)
        .set('Cookie', [`access_token=${accessToken1}`])
        .expect(200);

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId2}/address-book`)
        .set('Cookie', [`access_token=${accessToken2}`])
        .expect(200)
        .expect(({ body }) =>
          expect(body).toEqual({
            spaceId: spaceId2.toString(),
            data: [
              {
                address: mockAddress,
                name: mockName,
                chainIds: mockChainIds,
                createdBy: authPayload2.signer_address,
                lastUpdatedBy: authPayload2.signer_address,
              },
            ],
          }),
        );
    });

    it('should return a 404 if a space ID does not exist', async () => {
      const { accessToken } = await createSpace();
      const nonExistingSpaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });
      const address = getAddress(faker.finance.ethereumAddress());

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${nonExistingSpaceId}/address-book/${address}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404)
        .expect({
          statusCode: 404,
          message: 'Space not found.',
          error: 'Not Found',
        });
    });

    it('should return a 404 if the user does not exist', async () => {
      const { spaceId } = await createSpace();
      const authPayloadDto = authPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const address = getAddress(faker.finance.ethereumAddress());

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/address-book/${address}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404)
        .expect({
          statusCode: 404,
          message: 'User not found.',
          error: 'Not Found',
        });
    });

    it('should return a 404 if the member is not an ADMIN', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await inviteMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const address = getAddress(faker.finance.ethereumAddress());

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/address-book/${address}`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .expect(404)
        .expect({
          statusCode: 404,
          message: 'Space not found.',
          error: 'Not Found',
        });
    });

    it('should return a 403 if the AuthPayload is empty', async () => {
      const { spaceId } = await createSpace();
      const address = getAddress(faker.finance.ethereumAddress());

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/address-book/${address}`)
        .set('Cookie', [`access_token=`])
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });

    it('should return a 403 if not authenticated', async () => {
      const { spaceId } = await createSpace();
      const address = getAddress(faker.finance.ethereumAddress());

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/address-book/${address}`)
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
    });
  });

  // Utility functions

  const createSpace = async (): Promise<{
    spaceId: string;
    accessToken: string;
  }> => {
    const authPayloadDto = authPayloadDtoBuilder().build();
    const accessToken = jwtService.sign(authPayloadDto);
    const spaceName = nameBuilder();
    await request(app.getHttpServer())
      .post('/v1/users/wallet')
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(201);
    const createSpaceResponse = await request(app.getHttpServer())
      .post('/v1/spaces')
      .set('Cookie', [`access_token=${accessToken}`])
      .send({ name: spaceName })
      .expect(201);
    const spaceId = createSpaceResponse.body.id;
    return { spaceId, accessToken };
  };

  const inviteMember = async (args: {
    spaceId: string;
    adminAccessToken: string;
  }): Promise<{ memberAccessToken: string }> => {
    const memberAuthPayloadDto = authPayloadDtoBuilder().build();
    const memberAccessToken = jwtService.sign(memberAuthPayloadDto);
    const member = {
      role: 'MEMBER',
      name: faker.person.firstName(),
      address: memberAuthPayloadDto.signer_address,
    };
    await request(app.getHttpServer())
      .post(`/v1/spaces/${args.spaceId}/members/invite`)
      .set('Cookie', [`access_token=${args.adminAccessToken}`])
      .send({ users: [member] })
      .expect(201);
    return { memberAccessToken };
  };

  const createAddressBookItem = async (args: {
    spaceId: string;
    adminAccessToken: string;
    address?: `0x${string}`;
  }): Promise<{
    mockName: string;
    mockAddress: `0x${string}`;
    mockChainIds: Array<string>;
  }> => {
    const mockAddress =
      args?.address ?? getAddress(faker.finance.ethereumAddress());
    const mockName = nameBuilder();
    const mockChainIds = faker.helpers.multiple(() => faker.string.numeric(), {
      count: { min: 1, max: 5 },
    });

    await request(app.getHttpServer())
      .put(`/v1/spaces/${args.spaceId}/address-book`)
      .set('Cookie', [`access_token=${args.adminAccessToken}`])
      .send({
        items: [
          {
            name: mockName,
            address: mockAddress,
            chainIds: mockChainIds,
          },
        ],
      })
      .expect(200);

    return { mockName, mockAddress, mockChainIds };
  };
});
