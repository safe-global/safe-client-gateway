// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAddress } from 'viem';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { checkGuardIsApplied } from '@/__tests__/util/check-guard';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import {
  oidcAuthPayloadDtoBuilder,
  siweAuthPayloadDtoBuilder,
} from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/test.notification.repository.module';
import { MembersController } from '@/modules/spaces/routes/members.controller';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { fakeEmailAddress } from '@/validation/entities/schemas/__tests__/email-address.builder';

describe('MembersController', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let usersRepository: IUsersRepository;
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
    const configService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    maxInvites = configService.getOrThrow('spaces.maxInvites');

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Auth resolves the acting user from the JWT `sub`, so a token must carry the
  // id of the DB user it represents.
  const accessTokenForUserId = (userId: number): string =>
    jwtService.sign(
      siweAuthPayloadDtoBuilder().with('sub', userId.toString()).build(),
    );

  // A signer for someone who isn't a member: a large `sub` that can't collide
  // with another user's single-digit `sub`.
  const nonMemberToken = (): string =>
    accessTokenForUserId(
      faker.number.int({ min: 69420, max: DB_MAX_SAFE_INTEGER }),
    );

  // Registers a fresh user and creates a space they administer. Signs the
  // returned token in as the *real* user id.
  // Callers reuse the returned `accessToken` for their admin operations.
  const createSpaceForSigner = async (
    spaceName: string,
  ): Promise<{ accessToken: string; spaceId: number; userId: number }> => {
    const walletResponse = await request(app.getHttpServer())
      .post('/v1/users/wallet')
      .set('Cookie', [
        `access_token=${jwtService.sign(siweAuthPayloadDtoBuilder().build())}`,
      ])
      .expect(201);
    const userId = walletResponse.body.id;
    const accessToken = accessTokenForUserId(userId);
    const createSpaceResponse = await request(app.getHttpServer())
      .post('/v1/spaces')
      .set('Cookie', [`access_token=${accessToken}`])
      .send({ name: spaceName })
      .expect(201);
    return { accessToken, spaceId: createSpaceResponse.body.id, userId };
  };

  it('should require authentication for every endpoint', () => {
    const endpoints = Object.values(MembersController.prototype) as Array<
      (...args: Array<unknown>) => unknown
    >;

    for (const fn of endpoints) {
      checkGuardIsApplied(AuthGuard, fn);
    }
  });

  describe('POST /v1/spaces/:spaceId/members/invite', () => {
    it('should invite users', async () => {
      const spaceName = nameBuilder();
      const user1 = getAddress(faker.finance.ethereumAddress());
      const user1Name = faker.person.firstName();
      const user2 = getAddress(faker.finance.ethereumAddress());
      const user2Name = faker.person.firstName();

      const { accessToken, spaceId, userId } =
        await createSpaceForSigner(spaceName);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
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
              spaceId,
              name: user1Name,
              role: 'ADMIN',
              status: 'INVITED',
              invitedBy: userId,
            },
            {
              userId: expect.any(Number),
              spaceId,
              name: user2Name,
              role: 'MEMBER',
              status: 'INVITED',
              invitedBy: userId,
            },
          ]),
        );
    });

    it('should throw a 409 if there are too many invites', async () => {
      const spaceName = nameBuilder();
      const invites = Array.from({ length: maxInvites + 1 }).map(() => {
        return {
          role: faker.helpers.arrayElement(['ADMIN', 'MEMBER']),
          address: getAddress(faker.finance.ethereumAddress()),
          name: faker.person.firstName(),
        };
      });

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
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
      const spaceName = nameBuilder();
      const user1 = getAddress(faker.finance.ethereumAddress());
      const user1Name = faker.person.firstName();
      const user2 = getAddress(faker.finance.ethereumAddress());
      const user2Name = faker.person.firstName();

      const { spaceId } = await createSpaceForSigner(spaceName);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
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
      const spaceName = nameBuilder();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ users: [] })
        .expect(422);
    });

    it('should throw a 403 if the signer is not an active admin of the space', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceId = faker.number.int({
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
        .post(`/v1/spaces/${spaceId}/members/invite`)
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
        .expect(403)
        .expect({
          message: 'User is not an active admin.',
          error: 'Forbidden',
          statusCode: 403,
        });
    });

    it('should throw a 403 if the signer is not a member of the space', async () => {
      const nonMemberAccessToken = nonMemberToken();
      const spaceName = nameBuilder();
      const user1 = getAddress(faker.finance.ethereumAddress());
      const user1Name = faker.person.firstName();
      const user2 = getAddress(faker.finance.ethereumAddress());
      const user2Name = faker.person.firstName();

      const { spaceId } = await createSpaceForSigner(spaceName);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${nonMemberAccessToken}`])
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
          message: 'User is not an active admin.',
          error: 'Forbidden',
          statusCode: 403,
        });
    });

    it('should throw a 403 if the signer is an admin of another space', async () => {
      const adminAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const targetSpaceOwnerAuthPayloadDto =
        siweAuthPayloadDtoBuilder().build();
      const user = getAddress(faker.finance.ethereumAddress());
      const userName = faker.person.firstName();

      const adminUserResponse = await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${jwtService.sign(adminAuthPayloadDto)}`])
        .expect(201);
      const adminAccessToken = accessTokenForUserId(adminUserResponse.body.id);

      const targetSpaceOwnerResponse = await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [
          `access_token=${jwtService.sign(targetSpaceOwnerAuthPayloadDto)}`,
        ])
        .expect(201);
      const targetSpaceOwnerAccessToken = accessTokenForUserId(
        targetSpaceOwnerResponse.body.id,
      );

      await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({ name: nameBuilder() })
        .expect(201);

      const targetSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${targetSpaceOwnerAccessToken}`])
        .send({ name: nameBuilder() })
        .expect(201);
      const targetSpaceId = targetSpaceResponse.body.id;

      await request(app.getHttpServer())
        .post(`/v1/spaces/${targetSpaceId}/members/invite`)
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: user,
              name: userName,
            },
          ],
        })
        .expect(403)
        .expect({
          message: 'User is not an active admin.',
          error: 'Forbidden',
          statusCode: 403,
        });
    });

    it('should throw a 403 if the signer is not an admin', async () => {
      const inviteeAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const user = getAddress(faker.finance.ethereumAddress());
      const userName = faker.person.firstName();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      const inviteResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
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

      const inviteeAccessToken = accessTokenForUserId(
        inviteResponse.body[0].userId,
      );

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
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
        .expect(403)
        .expect({
          message: 'User is not an active admin.',
          error: 'Forbidden',
          statusCode: 403,
        });
    });

    it('should throw a 403 if the signer is not an active admin', async () => {
      const inviteeAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const user = getAddress(faker.finance.ethereumAddress());
      const userName = faker.person.firstName();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      const inviteResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
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

      const inviteeAccessToken = accessTokenForUserId(
        inviteResponse.body[0].userId,
      );

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
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
        .expect(403)
        .expect({
          message: 'User is not an active admin.',
          error: 'Forbidden',
          statusCode: 403,
        });
    });

    it('should throw a 409 if the user is already an active member of the space', async () => {
      const memberAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const memberAddress = memberAuthPayloadDto.signer_address;
      const memberName = nameBuilder();

      const { accessToken: adminAccessToken, spaceId } =
        await createSpaceForSigner(faker.word.noun());

      const inviteResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({
          users: [
            {
              role: 'ADMIN',
              address: memberAddress,
              name: memberName,
            },
          ],
        })
        .expect(201);
      const memberUserId = inviteResponse.body[0].userId;

      // Re-inviting an INVITED member only refreshes the invite; the member must
      // accept (becoming ACTIVE) for a second invite to conflict.
      const memberAccessToken = accessTokenForUserId(memberUserId);
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/accept`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({ name: memberName })
        .expect(201);

      // A second invitation to the now-active member should fail
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${adminAccessToken}`])
        .send({
          users: [
            {
              role: 'ADMIN',
              address: memberAddress,
              name: memberName,
            },
          ],
        })
        .expect(409)
        .expect({
          message: `${memberAddress} is already in this workspace or has a pending invite.`,
          error: 'Conflict',
          statusCode: 409,
        });
    });
  });

  describe('POST /v1/spaces/:spaceId/members/accept', () => {
    it('should accept an invite for a user', async () => {
      const inviteeAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const memberName = nameBuilder();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      const inviteResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: memberName,
            },
          ],
        })
        .expect(201);

      const inviteeAccessToken = accessTokenForUserId(
        inviteResponse.body[0].userId,
      );

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/accept`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({
          name: memberName,
        })
        .expect(201)
        .expect({});
    });

    it('should accept an invite for a user, changing name', async () => {
      const inviteeAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const invitedMemberName = faker.person.firstName();
      const acceptedMemberName = faker.person.firstName();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      const inviteResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: invitedMemberName,
            },
          ],
        })
        .expect(201);

      const inviteeAccessToken = accessTokenForUserId(
        inviteResponse.body[0].userId,
      );

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/accept`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({
          name: acceptedMemberName,
        })
        .expect(201)
        .expect({});
    });

    it('should accept an invite for a user invited by email', async () => {
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const inviteEmail = fakeEmailAddress();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      const inviteResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              type: 'email',
              email: inviteEmail,
              role: 'MEMBER',
              name: memberName,
            },
          ],
        })
        .expect(201);
      const invitedUserId = inviteResponse.body[0].userId;

      // The invitee signs in via OIDC, which claims the PENDING placeholder
      // created by the email invite (matched by email) and returns its id.
      const claimedUserId =
        await usersRepository.findOrCreateByExtUserIdAndEmail(
          faker.string.uuid(),
          inviteEmail,
        );
      expect(claimedUserId).toBe(invitedUserId);

      const inviteeAuthPayloadDto = oidcAuthPayloadDtoBuilder()
        .with('sub', claimedUserId.toString())
        .build();
      const inviteeAccessToken = jwtService.sign(inviteeAuthPayloadDto);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/accept`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({
          name: memberName,
        })
        .expect(201)
        .expect({});

      // The invitee is now an ACTIVE member with their email visible.
      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/members`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body.members).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                name: memberName,
                role: 'MEMBER',
                status: 'ACTIVE',
                user: expect.objectContaining({
                  id: invitedUserId,
                  email: inviteEmail,
                }),
              }),
            ]),
          );
        });
    });

    it('should throw a 403 if the user is not authenticated', async () => {
      const inviteeAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const memberName = nameBuilder();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: memberName,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/accept`)
        .send({
          name: memberName,
        })
        .expect(403)
        .expect({
          message: 'Forbidden resource',
          error: 'Forbidden',
          statusCode: 403,
        });
    });

    it('should throw a 404 if the signer has no pending invite', async () => {
      const nonUserAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const nonUserAccessToken = jwtService.sign(nonUserAuthPayloadDto);
      const spaceName = nameBuilder();
      const memberName = nameBuilder();

      const { spaceId } = await createSpaceForSigner(spaceName);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/accept`)
        .set('Cookie', [`access_token=${nonUserAccessToken}`])
        .send({
          name: memberName,
        })
        .expect(404)
        .expect({
          message: 'Workspace not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('should throw a 404 if the space does not exist', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });
      const memberName = nameBuilder();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/accept`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          name: memberName,
        })
        .expect(404)
        .expect({
          message: 'Workspace not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('should throw a 404 if the status of the member is not INVITED', async () => {
      const inviteeAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const memberName = nameBuilder();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      const inviteResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: memberName,
            },
          ],
        })
        .expect(201);

      const inviteeAccessToken = accessTokenForUserId(
        inviteResponse.body[0].userId,
      );

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/accept`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({
          name: memberName,
        })
        .expect(201)
        .expect({});

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/accept`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({
          name: memberName,
        })
        .expect(404)
        .expect({
          message: 'Workspace not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('should throw a 422 if the user name is not provided', async () => {
      const inviteeAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const inviteeAccessToken = jwtService.sign(inviteeAuthPayloadDto);
      const spaceName = nameBuilder();
      const memberName = nameBuilder();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: memberName,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/accept`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send()
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'invalid_type',
          expected: 'object',
          path: [],
          message: 'Invalid input: expected object, received undefined',
        });
    });
  });

  describe('POST /v1/spaces/:spaceId/members/decline', () => {
    it('should decline an invite for a user', async () => {
      const inviteeAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const memberName = nameBuilder();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      const inviteResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: memberName,
            },
          ],
        })
        .expect(201);

      const inviteeAccessToken = accessTokenForUserId(
        inviteResponse.body[0].userId,
      );

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/decline`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .expect(201)
        .expect({});
    });

    it('should throw a 403 if the user is not authenticated', async () => {
      const inviteeAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const memberName = nameBuilder();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: memberName,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/decline`)
        .expect(403)
        .expect({
          message: 'Forbidden resource',
          error: 'Forbidden',
          statusCode: 403,
        });
    });

    it('should throw a 404 if the signer has no pending invite', async () => {
      const nonUserAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const nonUserAccessToken = jwtService.sign(nonUserAuthPayloadDto);
      const spaceName = nameBuilder();

      const { spaceId } = await createSpaceForSigner(spaceName);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/decline`)
        .set('Cookie', [`access_token=${nonUserAccessToken}`])
        .expect(404)
        .expect({
          message: 'Workspace not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('should throw a 404 if the space does not exist', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/decline`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404)
        .expect({
          message: 'Workspace not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('should throw a 404 if the status of the member is not INVITED', async () => {
      const inviteeAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const memberName = nameBuilder();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      const inviteResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: memberName,
            },
          ],
        })
        .expect(201);

      const inviteeAccessToken = accessTokenForUserId(
        inviteResponse.body[0].userId,
      );

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/decline`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .expect(201)
        .expect({});

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/decline`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .expect(404)
        .expect({
          message: 'Workspace not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });
  });

  describe('GET /v1/spaces/:spaceId/members', () => {
    it('should return a list of members of a space', async () => {
      const spaceName = nameBuilder();
      const user1 = getAddress(faker.finance.ethereumAddress());
      const user1Name = faker.person.firstName();
      const user2 = getAddress(faker.finance.ethereumAddress());
      const user2Name = faker.person.firstName();
      const { accessToken, spaceId, userId } =
        await createSpaceForSigner(spaceName);
      const adminUserId = userId;

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
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
        .get(`/v1/spaces/${spaceId}/members`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            members: [
              {
                id: expect.any(Number),
                role: 'ADMIN',
                status: 'ACTIVE',
                name: `${spaceName} creator`,
                alias: null,
                invitedBy: null,
                inviteExpiresAt: null,
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
                user: {
                  id: adminUserId,
                  status: 'ACTIVE',
                  email: null,
                },
              },
              {
                id: expect.any(Number),
                role: 'ADMIN',
                status: 'INVITED',
                name: user1Name,
                alias: null,
                invitedBy: adminUserId,
                inviteExpiresAt: expect.any(String),
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
                user: {
                  id: expect.any(Number),
                  status: 'PENDING',
                  email: null,
                },
              },
              {
                id: expect.any(Number),
                role: 'MEMBER',
                status: 'INVITED',
                name: user2Name,
                alias: null,
                invitedBy: adminUserId,
                inviteExpiresAt: expect.any(String),
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
                user: {
                  id: expect.any(Number),
                  status: 'PENDING',
                  email: null,
                },
              },
            ],
          });
        });
    });

    it('should return email for active members', async () => {
      const spaceName = nameBuilder();
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
        .send({ name: spaceName })
        .expect(201);
      const spaceId = createSpaceResponse.body.id;

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/members`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body.members).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                status: 'ACTIVE',
                user: expect.objectContaining({
                  id: userId,
                  email,
                }),
              }),
            ]),
          );
        });
    });

    it('should return email for invited members when the caller is an active admin', async () => {
      const spaceName = nameBuilder();
      const invitedName = faker.person.firstName();
      const invitedEmail = fakeEmailAddress();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      const inviteResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              type: 'email',
              role: 'MEMBER',
              email: invitedEmail,
              name: invitedName,
            },
          ],
        })
        .expect(201);
      const invitedUserId = inviteResponse.body[0].userId;

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/members`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body.members).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                status: 'INVITED',
                user: expect.objectContaining({
                  id: invitedUserId,
                  email: invitedEmail,
                }),
              }),
            ]),
          );
        });
    });

    it('should hide email for invited members when the caller is not an active admin', async () => {
      const spaceName = nameBuilder();
      const invitedName = faker.person.firstName();
      const invitedEmail = fakeEmailAddress();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      const inviteResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              type: 'email',
              role: 'MEMBER',
              email: invitedEmail,
              name: invitedName,
            },
          ],
        })
        .expect(201);
      const invitedUserId = inviteResponse.body[0].userId;

      // The invited member can list members but is not an active admin.
      const invitedAuthPayloadDto = oidcAuthPayloadDtoBuilder()
        .with('sub', invitedUserId.toString())
        .build();
      const invitedAccessToken = jwtService.sign(invitedAuthPayloadDto);

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/members`)
        .set('Cookie', [`access_token=${invitedAccessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body.members).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                status: 'INVITED',
                user: expect.objectContaining({
                  id: invitedUserId,
                  email: null,
                }),
              }),
            ]),
          );
        });
    });

    it('should throw a 403 if the user is not authenticated', async () => {
      const spaceName = nameBuilder();
      const user1 = getAddress(faker.finance.ethereumAddress());
      const user1Name = faker.person.firstName();
      const user2 = getAddress(faker.finance.ethereumAddress());
      const user2Name = faker.person.firstName();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
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
        .get(`/v1/spaces/${spaceId}/members`)
        .expect(403)
        .expect({
          message: 'Forbidden resource',
          error: 'Forbidden',
          statusCode: 403,
        });
    });

    it('should throw a 403 if the signer is not an active member of the space', async () => {
      const nonUserAccessToken = nonMemberToken();
      const spaceName = nameBuilder();

      const { spaceId } = await createSpaceForSigner(spaceName);

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/members`)
        .set('Cookie', [`access_token=${nonUserAccessToken}`])
        .expect(403)
        .expect({
          message: 'The user is not an active member of the workspace.',
          error: 'Forbidden',
          statusCode: 403,
        });
    });

    it('should throw a 403 if the user is not a member of the space', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      // Space does not even exist
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/members`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(403)
        .expect({
          message: 'The user is not an active member of the workspace.',
          error: 'Forbidden',
          statusCode: 403,
        });
    });
  });

  describe('PATCH /v1/spaces/:spaceId/members/:userId/role', () => {
    it('should update the role of userId', async () => {
      const inviteeAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const memberName = nameBuilder();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      const inviteUsersResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: memberName,
            },
          ],
        })
        .expect(201);
      const userId = inviteUsersResponse.body[0].userId;

      const inviteeAccessToken = accessTokenForUserId(userId);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/accept`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({
          name: memberName,
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}/members/${userId}/role`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ role: 'ADMIN' })
        .expect(200)
        .expect({});
    });

    it('should throw a 403 if the user is not authenticated', async () => {
      const inviteeAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const memberName = nameBuilder();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      const inviteUsersResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: memberName,
            },
          ],
        })
        .expect(201);
      const userId = inviteUsersResponse.body[0].userId;

      const inviteeAccessToken = accessTokenForUserId(userId);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/accept`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({
          name: memberName,
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}/members/${userId}/role`)
        .send({ role: 'ADMIN' })
        .expect(403)
        .expect({
          message: 'Forbidden resource',
          error: 'Forbidden',
          statusCode: 403,
        });
    });

    it('should throw a 403 if the signer is not an active admin', async () => {
      const inviteeAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const nonUserAccessToken = nonMemberToken();
      const spaceName = nameBuilder();
      const memberName = nameBuilder();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      const inviteUsersResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: memberName,
            },
          ],
        })
        .expect(201);
      const userId = inviteUsersResponse.body[0].userId;

      const inviteeAccessToken = accessTokenForUserId(userId);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/accept`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({
          name: memberName,
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}/members/${userId}/role`)
        .set('Cookie', [`access_token=${nonUserAccessToken}`])
        .send({ role: 'ADMIN' })
        .expect(403)
        .expect({
          message: 'User is not an active admin.',
          error: 'Forbidden',
          statusCode: 403,
        });
    });

    it('should throw a 403 if the status of the signer member is not ACTIVE', async () => {
      const inviteeAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const memberName = nameBuilder();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      const inviteUsersResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: memberName,
            },
          ],
        })
        .expect(201);
      const userId = inviteUsersResponse.body[0].userId;

      // The invitee is INVITED (never accepted); its token carries that id to
      // exercise the "not an active admin" path rather than an unrelated user.
      const inviteeAccessToken = accessTokenForUserId(userId);

      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}/members/${userId}/role`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({ role: 'ADMIN' })
        .expect(403)
        .expect({
          message: 'User is not an active admin.',
          error: 'Forbidden',
          statusCode: 403,
        });
    });

    it('should throw a 403 if the signer member is not of ADMIN role', async () => {
      const inviteeAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const memberName = nameBuilder();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      const inviteUsersResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: memberName,
            },
          ],
        })
        .expect(201);
      const userId = inviteUsersResponse.body[0].userId;

      const inviteeAccessToken = accessTokenForUserId(userId);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/accept`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({
          name: memberName,
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}/members/${userId}/role`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({ role: 'ADMIN' })
        .expect(403)
        .expect({
          message: 'User is not an active admin.',
          error: 'Forbidden',
          statusCode: 403,
        });
    });

    it('should throw a 409 if downgrading the last ACTIVE ADMIN', async () => {
      const spaceName = nameBuilder();
      const { accessToken, spaceId, userId } =
        await createSpaceForSigner(spaceName);

      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}/members/${userId}/role`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ role: 'MEMBER' })
        .expect(409)
        .expect({
          message: 'Cannot remove last admin.',
          error: 'Conflict',
          statusCode: 409,
        });
    });

    it('should throw a 404 if the user-to-update member does not exist', async () => {
      const nonMemberAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const nonMemberAuthPayload = jwtService.sign(nonMemberAuthPayloadDto);
      const spaceName = nameBuilder();

      // A real, non-member user to target (exists, but isn't in the space).
      const createUserResponse = await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${nonMemberAuthPayload}`])
        .expect(201);
      const userId = createUserResponse.body.id;

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}/members/${userId}/role`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ role: 'ADMIN' })
        .expect(404)
        .expect({
          message: 'Member not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });
  });

  describe('DELETE /v1/spaces/:spaceId/members/:userId', () => {
    it('should remove a user', async () => {
      const inviteeAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const memberName = nameBuilder();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      const inviteUsersResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'ADMIN',
              address: inviteeAuthPayloadDto.signer_address,
              name: memberName,
            },
          ],
        })
        .expect(201);
      const userId = inviteUsersResponse.body[0].userId;

      const inviteeAccessToken = accessTokenForUserId(userId);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/accept`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({
          name: memberName,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/members/${userId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({});
    });

    it('should throw a 404 if the space does not exist', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });

      const createUserResponse = await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);
      const userId = createUserResponse.body.id;

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/members/${userId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404)
        .expect({
          message: 'No members found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('should throw a 403 if the status of the signer member is not ACTIVE', async () => {
      const inviteeAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const member = getAddress(faker.finance.ethereumAddress());
      const spaceName = nameBuilder();
      const adminName = faker.person.firstName();
      const memberName = nameBuilder();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      const inviteUsersResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
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
      const inviteeAccessToken = accessTokenForUserId(
        inviteUsersResponse.body[0].userId,
      );

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/members/${memberUserId}`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .expect(403)
        .expect({
          message: 'User is not an active admin.',
          error: 'Forbidden',
          statusCode: 403,
        });
    });

    it('should throw a 403 if the signer member is not of ADMIN status', async () => {
      const inviteeAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const memberName = nameBuilder();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      const inviteUsersResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: memberName,
            },
          ],
        })
        .expect(201);
      const userId = inviteUsersResponse.body[0].userId;

      const inviteeAccessToken = accessTokenForUserId(userId);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/accept`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({
          name: memberName,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/members/${userId}`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .expect(403)
        .expect({
          message: 'User is not an active admin.',
          error: 'Forbidden',
          statusCode: 403,
        });
    });

    it('should throw a 409 if removing the last ACTIVE ADMIN', async () => {
      const spaceName = nameBuilder();
      // The space creator (admin) removing themselves is the last active admin.
      const { accessToken, spaceId, userId } =
        await createSpaceForSigner(spaceName);

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/members/${userId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(409)
        .expect({
          message: 'Cannot remove last admin.',
          error: 'Conflict',
          statusCode: 409,
        });
    });
  });

  describe('PATCH /v1/spaces/:spaceId/members/alias', () => {
    it('should set the alias for the authenticated user when they are admin of the space', async () => {
      const spaceName = nameBuilder();
      const newAlias = nameBuilder();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}/members/alias`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ alias: newAlias })
        .expect(200);

      // Verify the alias was updated by getting the members list
      const getMembersResponse = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/members`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(getMembersResponse.body.members[0].alias).toBe(newAlias);
    });

    it('should set the alias for the authenticated user when they are a member of the space', async () => {
      const inviteeAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const spaceName = nameBuilder();
      const memberName = nameBuilder();
      const newAlias = nameBuilder();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      const inviteUsersResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          users: [
            {
              role: 'MEMBER',
              address: inviteeAuthPayloadDto.signer_address,
              name: memberName,
            },
          ],
        })
        .expect(201);
      const userId = inviteUsersResponse.body[0].userId;

      const inviteeAccessToken = accessTokenForUserId(userId);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/accept`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({ name: memberName })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}/members/alias`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .send({ alias: newAlias })
        .expect(200);

      // Verify the alias was updated by getting the members list
      const getMembersResponse = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/members`)
        .set('Cookie', [`access_token=${inviteeAccessToken}`])
        .expect(200);

      expect(getMembersResponse.body.members[1].user.id).toBe(userId);
      expect(getMembersResponse.body.members[1].alias).toBe(newAlias);
    });

    it('should throw a 403 if the user is not authenticated', async () => {
      const spaceName = nameBuilder();
      const newAlias = nameBuilder();

      const { spaceId } = await createSpaceForSigner(spaceName);

      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}/members/alias`)
        .send({ alias: newAlias })
        .expect(403)
        .expect({
          message: 'Forbidden resource',
          error: 'Forbidden',
          statusCode: 403,
        });
    });

    it('should throw a 404 if the space does not exist', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceId = faker.number.int({
        min: 69420,
        max: DB_MAX_SAFE_INTEGER,
      });
      const newAlias = nameBuilder();

      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}/members/alias`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ alias: newAlias })
        .expect(404)
        .expect({
          message: 'Member not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('should throw a 404 if the user is not a member of the space', async () => {
      const adminAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
      const nonMemberAccessToken = nonMemberToken();
      const spaceName = nameBuilder();
      const newAlias = nameBuilder();

      const adminUserResponse = await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${jwtService.sign(adminAuthPayloadDto)}`])
        .expect(201);
      const accessToken = accessTokenForUserId(adminUserResponse.body.id);

      const createSpaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: spaceName })
        .expect(201);
      const spaceId = createSpaceResponse.body.id;

      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}/members/alias`)
        .set('Cookie', [`access_token=${nonMemberAccessToken}`])
        .send({ alias: newAlias })
        .expect(404)
        .expect({
          message: 'Member not found.',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('should update alias from null to a value', async () => {
      const spaceName = nameBuilder();
      const newAlias = nameBuilder();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      // Verify initial alias is null
      const initialMembersResponse = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/members`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(initialMembersResponse.body.members[0].alias).toBeNull();

      // Update alias
      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}/members/alias`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ alias: newAlias })
        .expect(200);

      // Verify the alias was updated
      const updatedMembersResponse = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/members`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(updatedMembersResponse.body.members[0].alias).toBe(newAlias);
    });

    it('should update alias from one value to another', async () => {
      const spaceName = nameBuilder();
      const originalAlias = nameBuilder();
      const newAlias = nameBuilder();

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      // First update: set initial alias
      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}/members/alias`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ alias: originalAlias })
        .expect(200);

      // Verify initial alias was set
      const initialMembersResponse = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/members`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(initialMembersResponse.body.members[0].alias).toBe(originalAlias);

      // Second update: change to new alias
      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}/members/alias`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ alias: newAlias })
        .expect(200);

      // Verify the alias was updated
      const updatedMembersResponse = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/members`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(updatedMembersResponse.body.members[0].alias).toBe(newAlias);
    });

    it('should validate alias format', async () => {
      const spaceName = nameBuilder();
      const invalidAlias = '1';

      const { accessToken, spaceId } = await createSpaceForSigner(spaceName);

      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}/members/alias`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ alias: invalidAlias })
        .expect(422);
    });
  });
});
