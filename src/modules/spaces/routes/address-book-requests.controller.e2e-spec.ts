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

const MAX_PENDING_REQUESTS = 3;

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
        addressBookRequests: {
          maxPending: MAX_PENDING_REQUESTS,
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
    it('should create a request from the submitted contact', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await addMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const contact = buildContact();

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send(contact)
        .expect(201)
        .expect(({ body }) =>
          expect(body).toEqual(
            expect.objectContaining({
              id: expect.any(Number),
              name: contact.name,
              address: contact.address,
              chainIds: contact.chainIds,
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

    it('should return 422 if the name does not conform to the name schema', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await addMember({
        spaceId,
        adminAccessToken: accessToken,
      });

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({ ...buildContact(), name: '<>@!' })
        .expect(422);
    });

    it('should return 422 if chainIds is empty', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await addMember({
        spaceId,
        adminAccessToken: accessToken,
      });

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({ ...buildContact(), chainIds: [] })
        .expect(422);
    });

    it('should return 403 if not authenticated', async () => {
      const { spaceId } = await createSpace();

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .send(buildContact())
        .expect(403);
    });

    it('should return 403 for an invited member that has not accepted', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await inviteMember({
        spaceId,
        adminAccessToken: accessToken,
      });

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send(buildContact())
        .expect(403);
    });

    it('should return 409 if a pending request for the address already exists', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await addMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const contact = buildContact();

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send(contact)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({ ...contact, name: nameBuilder() })
        .expect(409);
    });

    it('should allow a new request for an address after rejection', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await addMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const contact = buildContact();

      const createRes = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send(contact)
        .expect(201);

      await request(app.getHttpServer())
        .put(
          `/v1/spaces/${spaceId}/address-book/requests/${createRes.body.id}/reject`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send(contact)
        .expect(201);
    });

    it('should return 400 when the pending request limit is reached', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await addMember({
        spaceId,
        adminAccessToken: accessToken,
      });

      for (let i = 0; i < MAX_PENDING_REQUESTS; i++) {
        await request(app.getHttpServer())
          .post(`/v1/spaces/${spaceId}/address-book/requests`)
          .set('Cookie', [`access_token=${memberAccessToken}`])
          .send(buildContact())
          .expect(201);
      }

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send(buildContact())
        .expect(400);
    });

    it('should create a request as an OIDC member (admin of own space)', async () => {
      const { spaceId, accessToken, userId } = await createSpaceAsOidcAdmin();
      const contact = buildContact();

      const response = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(contact)
        .expect(201);

      expect(response.body).toEqual({
        id: expect.any(Number),
        name: contact.name,
        address: contact.address,
        chainIds: contact.chainIds,
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
      const { memberAccessToken } = await addMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const contact = buildContact();

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send(contact)
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
              address: contact.address,
              status: 'PENDING',
            }),
          );
        });
    });

    it('should return only own pending requests for member', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken: member1Token } = await addMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const { memberAccessToken: member2Token } = await addMember({
        spaceId,
        adminAccessToken: accessToken,
      });

      const contact1 = buildContact();
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${member1Token}`])
        .send(contact1)
        .expect(201);

      const contact2 = buildContact();
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${member2Token}`])
        .send(contact2)
        .expect(201);

      // Member 1 should only see their own request
      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${member1Token}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body.data).toHaveLength(1);
          expect(body.data[0].address).toBe(contact1.address);
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
      const { memberAccessToken } = await addMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const contact = buildContact();

      // Create request
      const createRes = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send(contact)
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
                address: contact.address,
                name: contact.name,
                chainIds: contact.chainIds,
              }),
            ]),
          ),
        );
    });

    it('should return 403 if member tries to approve', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await addMember({
        spaceId,
        adminAccessToken: accessToken,
      });

      const createRes = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send(buildContact())
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
      const { memberAccessToken } = await addMember({
        spaceId,
        adminAccessToken: adminToken,
      });
      const contact = buildContact();
      const createResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send(contact)
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
                address: contact.address,
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
      const { memberAccessToken } = await addMember({
        spaceId,
        adminAccessToken: accessToken,
      });

      const createRes = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send(buildContact())
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
        .expect(({ body }) =>
          expect(body).toEqual(expect.objectContaining({ data: [] })),
        );
    });

    it('should return 400 if request is already approved', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await addMember({
        spaceId,
        adminAccessToken: accessToken,
      });

      const createRes = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send(buildContact())
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
      const { memberAccessToken } = await addMember({
        spaceId,
        adminAccessToken: adminToken,
      });
      const createResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send(buildContact())
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
        .expect(({ body }) =>
          expect(body).toEqual(expect.objectContaining({ data: [] })),
        );
    });
  });

  // Utility functions

  const buildContact = (): {
    name: string;
    address: Address;
    chainIds: Array<string>;
  } => ({
    name: nameBuilder(),
    address: getAddress(faker.finance.ethereumAddress()),
    chainIds: faker.helpers.uniqueArray(
      () => faker.string.numeric({ length: { min: 1, max: 5 } }),
      faker.number.int({ min: 1, max: 5 }),
    ),
  });

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
    const spaceId = createSpaceResponse.body.uuid;
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
      spaceId: createSpaceResponse.body.uuid,
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
    const member = {
      role: 'MEMBER',
      name: faker.person.firstName(),
      address: memberAuthPayloadDto.signer_address,
    };
    const inviteResponse = await request(app.getHttpServer())
      .post(`/v1/spaces/${args.spaceId}/members/invite`)
      .set('Cookie', [`access_token=${args.adminAccessToken}`])
      .send({ users: [member] })
      .expect(201);
    // Sign in as the invited user id so membership lookups resolve.
    const memberAccessToken = jwtService.sign({
      ...memberAuthPayloadDto,
      sub: String(inviteResponse.body[0].userId),
    });
    return { memberAccessToken };
  };

  // Invites a member and accepts the invite, so the member is ACTIVE.
  const addMember = async (args: {
    spaceId: string;
    adminAccessToken: string;
  }): Promise<{ memberAccessToken: string }> => {
    const { memberAccessToken } = await inviteMember(args);
    await request(app.getHttpServer())
      .post(`/v1/spaces/${args.spaceId}/members/accept`)
      .set('Cookie', [`access_token=${memberAccessToken}`])
      .send({ name: faker.person.firstName() })
      .expect(201);
    return { memberAccessToken };
  };
});
