// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { type Address, getAddress } from 'viem';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import configuration from '@/config/entities/__tests__/configuration';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import {
  oidcAuthPayloadDtoBuilder,
  siweAuthPayloadDtoBuilder,
} from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/test.notification.repository.module';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { fakeEmailAddress } from '@/validation/entities/schemas/__tests__/email-address.builder';

describe('UserAddressBookController', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let usersRepository: IUsersRepository;

  const defaultConfiguration = configuration();

  async function initApp(): Promise<INestApplication<Server>> {
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      spaces: {
        ...defaultConfiguration.spaces,
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
          originalModule: NotificationsRepositoryV2Module,
          testModule: TestNotificationsRepositoryV2Module,
        },
      ],
    });

    jwtService = moduleFixture.get<IJwtService>(IJwtService);
    usersRepository = moduleFixture.get<IUsersRepository>(IUsersRepository);
    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
    return app;
  }

  beforeAll(async () => {
    vi.resetAllMocks();
    app = await initApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /spaces/:spaceId/address-book/private', () => {
    it('should return empty private address book', async () => {
      const { spaceId, accessToken } = await createSpace();

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book/private`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({
          spaceId: spaceId.toString(),
          data: [],
        });
    });

    it('should return private contacts for the user', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { mockName, mockAddress, mockChainIds } =
        await createPrivateContact({ spaceId, accessToken });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book/private`)
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
                createdByUserId: expect.any(Number),
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
              },
            ],
          }),
        );
    });

    it('should not return private contacts of other members', async () => {
      const { spaceId, accessToken } = await createSpace();
      await createPrivateContact({ spaceId, accessToken });

      const { memberAccessToken } = await inviteMember({
        spaceId,
        adminAccessToken: accessToken,
      });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book/private`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .expect(200)
        .expect({
          spaceId: spaceId.toString(),
          data: [],
        });
    });

    it('should return a member private contacts', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await inviteMember({
        spaceId,
        adminAccessToken: accessToken,
      });

      const { mockName, mockAddress, mockChainIds } =
        await createPrivateContact({
          spaceId,
          accessToken: memberAccessToken,
        });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book/private`)
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
                createdByUserId: expect.any(Number),
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
              },
            ],
          }),
        );
    });

    it('should return 403 if not authenticated', async () => {
      const { spaceId } = await createSpace();

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book/private`)
        .expect(403);
    });

    it('should return private address book entries for an OIDC user', async () => {
      const { spaceId, accessToken, userId, email } =
        await createSpaceAsOidcAdmin();

      // Seed an entry.
      const mockAddress = getAddress(faker.finance.ethereumAddress());
      const mockName = nameBuilder();
      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/private`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          items: [{ name: mockName, address: mockAddress, chainIds: ['1'] }],
        })
        .expect(200);

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book/private`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({
            spaceId: spaceId.toString(),
            data: [
              expect.objectContaining({
                name: mockName,
                address: mockAddress,
                chainIds: ['1'],
                createdBy: email,
                createdByUserId: userId,
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
              }),
            ],
          });
        });
    });
  });

  describe('PUT /spaces/:spaceId/address-book/private', () => {
    it('should create a private contact', async () => {
      const { spaceId, accessToken } = await createSpace();
      const mockAddress = getAddress(faker.finance.ethereumAddress());
      const mockName = nameBuilder();
      const mockChainIds = [faker.string.numeric()];

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/private`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          items: [
            { name: mockName, address: mockAddress, chainIds: mockChainIds },
          ],
        })
        .expect(200)
        .expect(({ body }) =>
          expect(body.data).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                name: mockName,
                address: mockAddress,
                chainIds: mockChainIds,
              }),
            ]),
          ),
        );
    });

    it('should allow members to create private contacts', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await inviteMember({
        spaceId,
        adminAccessToken: accessToken,
      });

      const mockAddress = getAddress(faker.finance.ethereumAddress());
      const mockName = nameBuilder();

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/private`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({
          items: [{ name: mockName, address: mockAddress, chainIds: ['1'] }],
        })
        .expect(200);
    });

    it('should upsert private address book entries for an OIDC user', async () => {
      const { spaceId, accessToken, userId } = await createSpaceAsOidcAdmin();
      const mockAddress = getAddress(faker.finance.ethereumAddress());
      const mockName = nameBuilder();
      const mockChainIds = ['1', '100'];

      const response = await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/private`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          items: [
            { name: mockName, address: mockAddress, chainIds: mockChainIds },
          ],
        })
        .expect(200);

      expect(response.body).toEqual({
        spaceId: spaceId.toString(),
        data: [
          expect.objectContaining({
            name: mockName,
            address: mockAddress,
            chainIds: mockChainIds,
            createdBy: expect.any(String),
            createdByUserId: userId,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          }),
        ],
      });
    });

    it('should update an existing private contact', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { mockAddress } = await createPrivateContact({
        spaceId,
        accessToken,
      });
      const updatedName = nameBuilder();

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/private`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          items: [
            { name: updatedName, address: mockAddress, chainIds: ['1', '10'] },
          ],
        })
        .expect(200)
        .expect(({ body }) =>
          expect(body.data).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                name: updatedName,
                address: mockAddress,
                chainIds: ['1', '10'],
              }),
            ]),
          ),
        );
    });
  });

  describe('DELETE /spaces/:spaceId/address-book/private/:address', () => {
    it('should delete a private contact', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { mockAddress } = await createPrivateContact({
        spaceId,
        accessToken,
      });

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/address-book/private/${mockAddress}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      // Verify it's gone
      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book/private`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({ spaceId: spaceId.toString(), data: [] });
    });

    it('should delete a private address book entry for an OIDC user', async () => {
      const { spaceId, accessToken } = await createSpaceAsOidcAdmin();
      const mockAddress = getAddress(faker.finance.ethereumAddress());

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/private`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          items: [
            { name: nameBuilder(), address: mockAddress, chainIds: ['1'] },
          ],
        })
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/address-book/private/${mockAddress}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book/private`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({ spaceId: spaceId.toString(), data: [] });
    });
  });

  // Utility functions

  const createSpace = async (): Promise<{
    spaceId: string;
    accessToken: string;
  }> => {
    const authPayloadDto = siweAuthPayloadDtoBuilder().build();
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

  const createSpaceAsOidcAdmin = async (): Promise<{
    spaceId: string;
    accessToken: string;
    userId: number;
    email: string;
  }> => {
    const email = fakeEmailAddress();
    const userId = await usersRepository.findOrCreateByExtUserIdAndEmail(
      faker.string.uuid(),
      email,
    );
    const authPayloadDto = oidcAuthPayloadDtoBuilder()
      .with('sub', userId.toString())
      .build();
    const accessToken = jwtService.sign(authPayloadDto);
    const createSpaceResponse = await request(app.getHttpServer())
      .post('/v1/spaces')
      .set('Cookie', [`access_token=${accessToken}`])
      .send({ name: nameBuilder() })
      .expect(201);
    return {
      spaceId: createSpaceResponse.body.id,
      accessToken,
      userId,
      email,
    };
  };

  const inviteMember = async (args: {
    spaceId: string;
    adminAccessToken: string;
  }): Promise<{ memberAccessToken: string }> => {
    const memberAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
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

  const createPrivateContact = async (args: {
    spaceId: string;
    accessToken: string;
    address?: Address;
  }): Promise<{
    mockName: string;
    mockAddress: Address;
    mockChainIds: Array<string>;
  }> => {
    const mockAddress =
      args?.address ?? getAddress(faker.finance.ethereumAddress());
    const mockName = nameBuilder();
    const mockChainIds = faker.helpers.multiple(() => faker.string.numeric(), {
      count: { min: 1, max: 5 },
    });

    await request(app.getHttpServer())
      .put(`/v1/spaces/${args.spaceId}/address-book/private`)
      .set('Cookie', [`access_token=${args.accessToken}`])
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
