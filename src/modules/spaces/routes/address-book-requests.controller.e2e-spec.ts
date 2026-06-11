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

describe('AddressBookRequestsController', () => {
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
    jest.resetAllMocks();
    app = await initApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /spaces/:spaceId/address-book/requests', () => {
    it('should create a request from a private contact', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await invitePendingMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const { mockAddress } = await createPrivateContact({
        spaceId,
        accessToken: memberAccessToken,
      });

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({ address: mockAddress })
        .expect(201)
        .expect(({ body }) =>
          expect(body).toEqual(
            expect.objectContaining({
              id: expect.any(Number),
              address: mockAddress,
              status: 'PENDING',
              requestedBy: expect.any(String),
              requestedByUserId: expect.any(Number),
              reviewedBy: null,
              reviewedByUserId: null,
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
            }),
          ),
        );
    });

    it('should return 404 if private contact does not exist', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await invitePendingMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const fakeAddress = getAddress(faker.finance.ethereumAddress());

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({ address: fakeAddress })
        .expect(404);
    });

    it('should return 403 if not authenticated', async () => {
      const { spaceId } = await createSpace();
      const fakeAddress = getAddress(faker.finance.ethereumAddress());

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .send({ address: fakeAddress })
        .expect(403);
    });

    it('should create a request as an OIDC member (admin of own space)', async () => {
      const { spaceId, accessToken, userId } = await createSpaceAsOidcAdmin();
      const { mockName, mockAddress, mockChainIds } =
        await createPrivateContact({
          spaceId,
          accessToken,
        });

      const response = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ address: mockAddress })
        .expect(201);

      expect(response.body).toEqual({
        id: expect.any(Number),
        name: mockName,
        address: mockAddress,
        chainIds: mockChainIds,
        requestedBy: expect.any(String),
        requestedByUserId: userId,
        reviewedBy: null,
        reviewedByUserId: null,
        status: 'PENDING',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });
  });

  describe('GET /spaces/:spaceId/address-book/requests', () => {
    it('should return pending requests for admin (all requests)', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await invitePendingMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const { mockAddress } = await createPrivateContact({
        spaceId,
        accessToken: memberAccessToken,
      });

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({ address: mockAddress })
        .expect(201);

      // Admin should see the pending request
      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body.data).toHaveLength(1);
          expect(body.data[0]).toEqual(
            expect.objectContaining({
              address: mockAddress,
              status: 'PENDING',
            }),
          );
        });
    });

    it('should return only own pending requests for member', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken: member1Token } = await invitePendingMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const { memberAccessToken: member2Token } = await invitePendingMember({
        spaceId,
        adminAccessToken: accessToken,
      });

      // Member 1 creates and requests a contact
      const { mockAddress: addr1 } = await createPrivateContact({
        spaceId,
        accessToken: member1Token,
      });
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${member1Token}`])
        .send({ address: addr1 })
        .expect(201);

      // Member 2 creates and requests a different contact
      const { mockAddress: addr2 } = await createPrivateContact({
        spaceId,
        accessToken: member2Token,
      });
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${member2Token}`])
        .send({ address: addr2 })
        .expect(201);

      // Member 1 should only see their own request
      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${member1Token}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body.data).toHaveLength(1);
          expect(body.data[0].address).toBe(addr1);
        });

      // Admin should see both
      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body.data).toHaveLength(2);
        });
    });
  });

  describe('PUT /spaces/:spaceId/address-book/requests/:id/approve', () => {
    it('should approve a request and add contact to shared address book', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await invitePendingMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const { mockAddress, mockName, mockChainIds } =
        await createPrivateContact({
          spaceId,
          accessToken: memberAccessToken,
        });

      // Create request
      const createRes = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({ address: mockAddress })
        .expect(201);

      const requestId = createRes.body.id;

      // Admin approves
      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/requests/${requestId}/approve`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      // Contact should now appear in the shared address book
      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) =>
          expect(body.data).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                address: mockAddress,
                name: mockName,
                chainIds: mockChainIds,
              }),
            ]),
          ),
        );
    });

    it('should return 403 if member tries to approve', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await invitePendingMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const { mockAddress } = await createPrivateContact({
        spaceId,
        accessToken: memberAccessToken,
      });

      const createRes = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({ address: mockAddress })
        .expect(201);

      // Member tries to approve their own request
      await request(app.getHttpServer())
        .put(
          `/v1/spaces/${spaceId}/address-book/requests/${createRes.body.id}/approve`,
        )
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .expect(403);
    });

    it('should approve a request as an OIDC admin', async () => {
      const {
        spaceId,
        accessToken: adminToken,
        userId: adminUserId,
      } = await createSpaceAsOidcAdmin();
      const { memberAccessToken } = await invitePendingMember({
        spaceId,
        adminAccessToken: adminToken,
      });
      const { mockAddress } = await createPrivateContact({
        spaceId,
        accessToken: memberAccessToken,
      });
      const createResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({ address: mockAddress })
        .expect(201);
      const requestId = createResponse.body.id;

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/requests/${requestId}/approve`)
        .set('Cookie', [`access_token=${adminToken}`])
        .expect(200);

      // Approved requests are no longer in the PENDING list, but the shared
      // space address book should now contain the entry.
      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${adminToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body.data).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                address: mockAddress,
                createdByUserId: expect.any(Number),
                lastUpdatedByUserId: adminUserId,
              }),
            ]),
          );
        });
    });
  });

  describe('PUT /spaces/:spaceId/address-book/requests/:id/reject', () => {
    it('should reject a pending request', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await invitePendingMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const { mockAddress } = await createPrivateContact({
        spaceId,
        accessToken: memberAccessToken,
      });

      const createRes = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({ address: mockAddress })
        .expect(201);

      // Admin rejects
      await request(app.getHttpServer())
        .put(
          `/v1/spaces/${spaceId}/address-book/requests/${createRes.body.id}/reject`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      // Should not appear in shared address book
      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({ spaceId: spaceId.toString(), data: [] });

      // Private contact should still exist
      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book/private`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body.data).toHaveLength(1);
          expect(body.data[0].address).toBe(mockAddress);
        });
    });

    it('should return 400 if request is already approved', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await invitePendingMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const { mockAddress } = await createPrivateContact({
        spaceId,
        accessToken: memberAccessToken,
      });

      const createRes = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({ address: mockAddress })
        .expect(201);

      const requestId = createRes.body.id;

      // Approve first
      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/requests/${requestId}/approve`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      // Try to reject — should fail
      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/requests/${requestId}/reject`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(400);
    });

    it('should reject a request as an OIDC admin', async () => {
      const { spaceId, accessToken: adminToken } =
        await createSpaceAsOidcAdmin();
      const { memberAccessToken } = await invitePendingMember({
        spaceId,
        adminAccessToken: adminToken,
      });
      const { mockAddress } = await createPrivateContact({
        spaceId,
        accessToken: memberAccessToken,
      });
      const createResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({ address: mockAddress })
        .expect(201);
      const requestId = createResponse.body.id;

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/requests/${requestId}/reject`)
        .set('Cookie', [`access_token=${adminToken}`])
        .expect(200);

      // Rejected requests are not in the PENDING list; member sees an empty list.
      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
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

  const invitePendingMember = async (args: {
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
