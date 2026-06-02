// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { MoreThan } from 'typeorm';
import { getAddress } from 'viem';
import {
  oidcAuthPayloadDtoBuilder,
  siweAuthPayloadDtoBuilder,
} from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import type { SpaceSafe } from '@/modules/spaces/datasources/entities/space-safes.entity.db';
import { spaceBuilder } from '@/modules/spaces/domain/entities/__tests__/space.entity.db.builder';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { SpacesService } from '@/modules/spaces/routes/spaces.service';
import { memberBuilder } from '@/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import { userBuilder } from '@/modules/users/datasources/entities/__tests__/users.entity.db.builder';
import type { IMembersRepository } from '@/modules/users/domain/members.repository.interface';
import type { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import type { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import type { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';

const spacesRepositoryMock = {
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
} as jest.MockedObjectDeep<ISpacesRepository>;

const membersRepositoryMock = {
  find: jest.fn(),
  findOne: jest.fn(),
} as jest.MockedObjectDeep<IMembersRepository>;

const usersRepositoryMock = {
  findOneOrFail: jest.fn(),
  activateIfPending: jest.fn(),
  findEmailsByIds: jest.fn(),
} as jest.MockedObjectDeep<IUsersRepository>;

const walletsRepositoryMock = {
  find: jest.fn(),
} as jest.MockedObjectDeep<IWalletsRepository>;

describe('SpacesService', () => {
  let service: SpacesService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new SpacesService(
      usersRepositoryMock,
      spacesRepositoryMock,
      membersRepositoryMock,
      walletsRepositoryMock,
    );
  });

  describe('getActiveOrInvitedSpaces', () => {
    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should return spaces for %s user', async (_label, builder) => {
      const authPayload = new AuthPayload(builder().build());
      const userId = Number(authPayload.sub);
      const user = userBuilder().with('id', userId).build();
      const space = spaceBuilder().build();
      const member = memberBuilder()
        .with('user', user)
        .with('space', space)
        .build();

      membersRepositoryMock.find.mockResolvedValue([member]);

      const mockSpace = spaceBuilder()
        .with('id', space.id)
        .with('name', space.name)
        .with('members', [member])
        .with('safes', [
          { id: 1 } as SpaceSafe,
          { id: 2 } as SpaceSafe,
          { id: 3 } as SpaceSafe,
        ])
        .build();

      spacesRepositoryMock.find.mockResolvedValue([mockSpace]);

      const result = await service.getActiveOrInvitedSpaces(authPayload);

      expect(result).toEqual([
        {
          id: mockSpace.uuid,
          name: space.name,
          members: [member],
          safeCount: 3,
        },
      ]);
      expect(spacesRepositoryMock.find).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            members: expect.objectContaining({
              inviteExpiresAt: true,
            }),
          }),
        }),
      );
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should only include non-expired invited spaces for %s user', async (_label, builder) => {
      const authPayload = new AuthPayload(builder().build());
      const userId = Number(authPayload.sub);

      membersRepositoryMock.find.mockResolvedValue([]);

      await service.getActiveOrInvitedSpaces(authPayload);

      expect(membersRepositoryMock.find).toHaveBeenCalledWith({
        where: [
          { user: { id: userId }, status: 'ACTIVE' },
          {
            user: { id: userId },
            status: 'INVITED',
            inviteExpiresAt: MoreThan(expect.any(Date)),
          },
        ],
        relations: ['space'],
      });
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should return safeCount 0 when %s space has no safes', async (_label, builder) => {
      const authPayload = new AuthPayload(builder().build());
      const userId = Number(authPayload.sub);
      const space = spaceBuilder().build();
      const member = memberBuilder()
        .with('user', userBuilder().with('id', userId).build())
        .with('space', space)
        .build();

      membersRepositoryMock.find.mockResolvedValue([member]);
      spacesRepositoryMock.find.mockResolvedValue([
        spaceBuilder()
          .with('id', space.id)
          .with('members', [])
          .with('safes', [])
          .build(),
      ]);

      const result = await service.getActiveOrInvitedSpaces(authPayload);

      expect(result).toHaveLength(1);
      expect(result[0].safeCount).toBe(0);
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should return safeCount 0 when %s space.safes is undefined', async (_label, builder) => {
      const authPayload = new AuthPayload(builder().build());
      const userId = Number(authPayload.sub);
      const space = spaceBuilder().build();
      const member = memberBuilder()
        .with('user', userBuilder().with('id', userId).build())
        .with('space', space)
        .build();

      membersRepositoryMock.find.mockResolvedValue([member]);
      spacesRepositoryMock.find.mockResolvedValue([
        spaceBuilder().with('id', space.id).with('members', []).build(),
      ]);

      const result = await service.getActiveOrInvitedSpaces(authPayload);

      expect(result).toHaveLength(1);
      expect(result[0].safeCount).toBe(0);
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should return empty array when %s user has no memberships', async (_label, builder) => {
      const authPayload = new AuthPayload(builder().build());

      membersRepositoryMock.find.mockResolvedValue([]);

      const result = await service.getActiveOrInvitedSpaces(authPayload);

      expect(result).toEqual([]);
      expect(spacesRepositoryMock.find).not.toHaveBeenCalled();
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should return multiple spaces with correct safeCount for %s user', async (_label, builder) => {
      const authPayload = new AuthPayload(builder().build());
      const userId = Number(authPayload.sub);
      const user = userBuilder().with('id', userId).build();
      const space1 = spaceBuilder().build();
      const space2 = spaceBuilder().build();
      const member1 = memberBuilder()
        .with('user', user)
        .with('space', space1)
        .with('status', 'ACTIVE')
        .build();
      const member2 = memberBuilder()
        .with('user', user)
        .with('space', space2)
        .with('status', 'INVITED')
        .build();

      membersRepositoryMock.find.mockResolvedValue([member1, member2]);
      spacesRepositoryMock.find.mockResolvedValue([
        spaceBuilder()
          .with('id', space1.id)
          .with('members', [])
          .with('safes', [{ id: 1 } as SpaceSafe, { id: 2 } as SpaceSafe])
          .build(),
        spaceBuilder()
          .with('id', space2.id)
          .with('members', [])
          .with('safes', [{ id: 3 } as SpaceSafe])
          .build(),
      ]);

      const result = await service.getActiveOrInvitedSpaces(authPayload);

      expect(result).toHaveLength(2);
      expect(result[0].safeCount).toBe(2);
      expect(result[1].safeCount).toBe(1);
    });

    it('should populate invitedByName with wallet address for INVITED member', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const callerUserId = Number(authPayload.sub);
      const inviterUserId = faker.number.int();
      const walletAddress = getAddress(faker.finance.ethereumAddress());

      const caller = userBuilder().with('id', callerUserId).build();
      const inviter = userBuilder().with('id', inviterUserId).build();
      const space = spaceBuilder().build();

      const callerMember = memberBuilder()
        .with('user', caller)
        .with('space', space)
        .with('status', 'INVITED')
        .with('invitedBy', inviterUserId)
        .build();
      const inviterMember = memberBuilder()
        .with('user', inviter)
        .with('space', space)
        .with('status', 'ACTIVE')
        .with('invitedBy', null)
        .build();

      membersRepositoryMock.find.mockResolvedValue([callerMember]);
      spacesRepositoryMock.find.mockResolvedValue([
        spaceBuilder()
          .with('id', space.id)
          .with('name', space.name)
          .with('members', [inviterMember, callerMember])
          .with('safes', [])
          .build(),
      ]);
      walletsRepositoryMock.find.mockResolvedValue([
        { address: walletAddress, user: { id: inviterUserId } } as Wallet,
      ]);

      const result = await service.getActiveOrInvitedSpaces(authPayload);

      const invitedMember = result[0].members.find(
        (m) => m.status === 'INVITED',
      );
      expect(invitedMember).toEqual(
        expect.objectContaining({
          invitedByName: walletAddress,
        }),
      );
    });

    it('should populate invitedByName with email for OIDC inviter (no wallet)', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const callerUserId = Number(authPayload.sub);
      const inviterUserId = faker.number.int();
      const inviterEmail = faker.internet.email().toLowerCase();

      const caller = userBuilder().with('id', callerUserId).build();
      const inviter = userBuilder().with('id', inviterUserId).build();
      const space = spaceBuilder().build();

      const callerMember = memberBuilder()
        .with('user', caller)
        .with('space', space)
        .with('status', 'INVITED')
        .with('invitedBy', inviterUserId)
        .build();
      const inviterMember = memberBuilder()
        .with('user', inviter)
        .with('space', space)
        .with('status', 'ACTIVE')
        .with('invitedBy', null)
        .build();

      membersRepositoryMock.find.mockResolvedValue([callerMember]);
      spacesRepositoryMock.find.mockResolvedValue([
        spaceBuilder()
          .with('id', space.id)
          .with('name', space.name)
          .with('members', [inviterMember, callerMember])
          .with('safes', [])
          .build(),
      ]);
      walletsRepositoryMock.find.mockResolvedValue([]);
      usersRepositoryMock.findEmailsByIds.mockResolvedValue(
        new Map([[inviterUserId, inviterEmail]]),
      );

      const result = await service.getActiveOrInvitedSpaces(authPayload);

      const invitedMember = result[0].members.find(
        (m) => m.status === 'INVITED',
      );
      expect(invitedMember).toEqual(
        expect.objectContaining({
          invitedByName: inviterEmail,
        }),
      );
    });

    it('should not populate invitedByName when inviter left the space', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const callerUserId = Number(authPayload.sub);
      const inviterUserId = faker.number.int();

      const caller = userBuilder().with('id', callerUserId).build();
      const space = spaceBuilder().build();

      const callerMember = memberBuilder()
        .with('user', caller)
        .with('space', space)
        .with('status', 'INVITED')
        .with('invitedBy', inviterUserId)
        .build();

      membersRepositoryMock.find.mockResolvedValue([callerMember]);
      spacesRepositoryMock.find.mockResolvedValue([
        spaceBuilder()
          .with('id', space.id)
          .with('name', space.name)
          .with('members', [callerMember])
          .with('safes', [])
          .build(),
      ]);

      const result = await service.getActiveOrInvitedSpaces(authPayload);

      const invitedMember = result[0].members.find(
        (m) => m.status === 'INVITED',
      );
      expect(invitedMember).not.toHaveProperty('invitedByName');
      expect(walletsRepositoryMock.find).not.toHaveBeenCalled();
      expect(usersRepositoryMock.findEmailsByIds).not.toHaveBeenCalled();
    });

    it('should not leak invitedByName across spaces when inviter is only a member of one', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const callerUserId = Number(authPayload.sub);
      const inviterUserId = faker.number.int();
      const walletAddress = getAddress(faker.finance.ethereumAddress());

      const caller = userBuilder().with('id', callerUserId).build();
      const inviter = userBuilder().with('id', inviterUserId).build();
      const spaceA = spaceBuilder().build();
      const spaceB = spaceBuilder().build();

      // Space A: inviter is still a member → invitedByName should be populated
      const callerMemberA = memberBuilder()
        .with('user', caller)
        .with('space', spaceA)
        .with('status', 'INVITED')
        .with('invitedBy', inviterUserId)
        .build();
      const inviterMemberA = memberBuilder()
        .with('user', inviter)
        .with('space', spaceA)
        .with('status', 'ACTIVE')
        .with('invitedBy', null)
        .build();

      // Space B: inviter has left → invitedByName must NOT be populated
      const callerMemberB = memberBuilder()
        .with('user', caller)
        .with('space', spaceB)
        .with('status', 'INVITED')
        .with('invitedBy', inviterUserId)
        .build();

      membersRepositoryMock.find.mockResolvedValue([
        callerMemberA,
        callerMemberB,
      ]);
      spacesRepositoryMock.find.mockResolvedValue([
        spaceBuilder()
          .with('id', spaceA.id)
          .with('name', spaceA.name)
          .with('members', [inviterMemberA, callerMemberA])
          .with('safes', [])
          .build(),
        spaceBuilder()
          .with('id', spaceB.id)
          .with('name', spaceB.name)
          .with('members', [callerMemberB]) // inviter is NOT a member here
          .with('safes', [])
          .build(),
      ]);
      walletsRepositoryMock.find.mockResolvedValue([
        { address: walletAddress, user: { id: inviterUserId } } as Wallet,
      ]);

      const result = await service.getActiveOrInvitedSpaces(authPayload);

      // Space A: inviter present → invitedByName populated
      const spaceAResult = result.find((s) => s.id === spaceA.id)!;
      const invitedInA = spaceAResult.members.find(
        (m) => m.status === 'INVITED',
      );
      expect(invitedInA).toEqual(
        expect.objectContaining({ invitedByName: walletAddress }),
      );

      // Space B: inviter absent → invitedByName must NOT leak from Space A
      const spaceBResult = result.find((s) => s.id === spaceB.id)!;
      const invitedInB = spaceBResult.members.find(
        (m) => m.status === 'INVITED',
      );
      expect(invitedInB).not.toHaveProperty('invitedByName');
    });

    it('should not populate invitedByName for ACTIVE members even when invitedBy is set', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const callerUserId = Number(authPayload.sub);
      const inviterUserId = faker.number.int();

      const caller = userBuilder().with('id', callerUserId).build();
      const inviter = userBuilder().with('id', inviterUserId).build();
      const space = spaceBuilder().build();

      // Caller previously accepted the invite — ACTIVE but invitedBy is still set
      const callerMember = memberBuilder()
        .with('user', caller)
        .with('space', space)
        .with('status', 'ACTIVE')
        .with('invitedBy', inviterUserId)
        .build();
      const inviterMember = memberBuilder()
        .with('user', inviter)
        .with('space', space)
        .with('status', 'ACTIVE')
        .with('invitedBy', null)
        .build();

      membersRepositoryMock.find.mockResolvedValue([callerMember]);
      spacesRepositoryMock.find.mockResolvedValue([
        spaceBuilder()
          .with('id', space.id)
          .with('name', space.name)
          .with('members', [inviterMember, callerMember])
          .with('safes', [])
          .build(),
      ]);

      const result = await service.getActiveOrInvitedSpaces(authPayload);

      const activeCaller = result[0].members.find(
        (m) => m.user.id === callerUserId,
      );
      expect(activeCaller).not.toHaveProperty('invitedByName');
      expect(walletsRepositoryMock.find).not.toHaveBeenCalled();
      expect(usersRepositoryMock.findEmailsByIds).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for unauthenticated payload', async () => {
      const authPayload = new AuthPayload();

      await expect(
        service.getActiveOrInvitedSpaces(authPayload),
      ).rejects.toThrow(UnauthorizedException);

      expect(membersRepositoryMock.find).not.toHaveBeenCalled();
    });
  });

  describe('getActiveOrInvitedSpace', () => {
    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should return a space by ID for %s user', async (_label, builder) => {
      const authPayload = new AuthPayload(builder().build());
      const userId = Number(authPayload.sub);
      const space = spaceBuilder()
        .with('members', [])
        .with('safes', [])
        .build();
      const member = memberBuilder()
        .with('user', userBuilder().with('id', userId).build())
        .with('space', space)
        .build();

      membersRepositoryMock.find.mockResolvedValue([member]);
      spacesRepositoryMock.find.mockResolvedValue([space]);

      const result = await service.getActiveOrInvitedSpace(
        space.uuid,
        authPayload,
      );

      expect(result.id).toBe(space.uuid);
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should throw NotFoundException when space ID not found for %s user', async (_label, builder) => {
      const authPayload = new AuthPayload(builder().build());

      membersRepositoryMock.find.mockResolvedValue([]);

      await expect(
        service.getActiveOrInvitedSpace(
          '00000000-0000-0000-0000-000000000000',
          authPayload,
        ),
      ).rejects.toThrow(new NotFoundException('Workspace not found.'));
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should throw NotFoundException when %s user has no spaces', async (_label, builder) => {
      const authPayload = new AuthPayload(builder().build());

      membersRepositoryMock.find.mockResolvedValue([]);

      await expect(
        service.getActiveOrInvitedSpace(
          '00000000-0000-0000-0000-000000000000',
          authPayload,
        ),
      ).rejects.toThrow(new NotFoundException('Workspace not found.'));
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should throw NotFoundException when %s user is not a member of the space', async (_label, builder) => {
      const authPayload = new AuthPayload(builder().build());
      const spaceId = faker.number.int();

      // The space exists and has members, but none belong to this user, so
      // the user-scoped query returns no rows.
      membersRepositoryMock.find.mockResolvedValue([]);

      await expect(
        service.getActiveOrInvitedSpace(spaceId, authPayload),
      ).rejects.toThrow(new NotFoundException('Workspace not found.'));
      expect(spacesRepositoryMock.find).not.toHaveBeenCalled();
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should scope every membership clause to the user and the requested space for %s user', async (_label, builder) => {
      const authPayload = new AuthPayload(builder().build());
      const userId = Number(authPayload.sub);
      const spaceId = faker.number.int();

      membersRepositoryMock.find.mockResolvedValue([]);

      await expect(
        service.getActiveOrInvitedSpace(spaceId, authPayload),
      ).rejects.toThrow(new NotFoundException('Workspace not found.'));

      expect(membersRepositoryMock.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: [
            { user: { id: userId }, status: 'ACTIVE', space: { id: spaceId } },
            {
              user: { id: userId },
              status: 'INVITED',
              inviteExpiresAt: MoreThan(expect.any(Date)),
              space: { id: spaceId },
            },
          ],
        }),
      );
    });
  });

  describe('create', () => {
    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should create space for %s user', async (_label, builder) => {
      const authPayload = new AuthPayload(builder().build());
      const userId = Number(authPayload.sub);
      const name = faker.word.noun();
      const repositoryResponse = {
        id: faker.number.int(),
        uuid: faker.string.uuid(),
        name,
      };

      spacesRepositoryMock.create.mockResolvedValue(repositoryResponse);

      const result = await service.create({
        name,
        status: 'ACTIVE',
        authPayload,
      });

      expect(result).toEqual({ id: repositoryResponse.uuid, name });
      expect(usersRepositoryMock.activateIfPending).toHaveBeenCalledWith(
        userId,
      );
      expect(spacesRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId }),
      );
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should activate a PENDING %s user when creating space', async (_label, builder) => {
      const authPayload = new AuthPayload(builder().build());
      const userId = Number(authPayload.sub);
      const expectedResponse = {
        id: faker.number.int(),
        uuid: faker.string.uuid(),
        name: faker.word.noun(),
      };

      spacesRepositoryMock.create.mockResolvedValue(expectedResponse);

      await service.create({
        name: expectedResponse.name,
        status: 'ACTIVE',
        authPayload,
      });

      expect(usersRepositoryMock.activateIfPending).toHaveBeenCalledWith(
        userId,
      );
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should throw NotFoundException when %s user no longer exists', async (_label, builder) => {
      const authPayload = new AuthPayload(builder().build());
      usersRepositoryMock.findOneOrFail.mockRejectedValue(
        new NotFoundException('User not found.'),
      );

      await expect(
        service.create({
          name: faker.word.noun(),
          status: 'ACTIVE',
          authPayload,
        }),
      ).rejects.toThrow(new NotFoundException('User not found.'));
      expect(usersRepositoryMock.activateIfPending).not.toHaveBeenCalled();
      expect(spacesRepositoryMock.create).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for unauthenticated payload', async () => {
      await expect(
        service.create({
          name: faker.word.noun(),
          status: 'ACTIVE',
          authPayload: new AuthPayload(),
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(usersRepositoryMock.findOneOrFail).not.toHaveBeenCalled();
      expect(usersRepositoryMock.activateIfPending).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should update space for %s admin', async (_label, builder) => {
      const spaceId = faker.number.int();
      const spaceUuid = faker.string.uuid();
      const authPayload = new AuthPayload(builder().build());
      const updatePayload = { name: faker.word.noun() };

      spacesRepositoryMock.findOne.mockResolvedValue(
        spaceBuilder().with('id', spaceId).with('uuid', spaceUuid).build(),
      );
      spacesRepositoryMock.update.mockResolvedValue({
        id: spaceId,
        uuid: spaceUuid,
      });

      const result = await service.update({
        id: spaceId,
        updatePayload,
        authPayload,
      });

      expect(result).toEqual({ id: spaceUuid });
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should throw when %s user is not admin', async (_label, builder) => {
      const authPayload = new AuthPayload(builder().build());
      spacesRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.update({
          id: faker.number.int(),
          updatePayload: { name: faker.word.noun() },
          authPayload,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('delete', () => {
    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should delete space for %s admin', async (_label, builder) => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(builder().build());

      spacesRepositoryMock.findOne.mockResolvedValue(
        spaceBuilder().with('id', spaceId).build(),
      );

      await service.delete({ id: spaceId, authPayload });

      expect(spacesRepositoryMock.delete).toHaveBeenCalledWith(spaceId);
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should throw when %s user is not admin', async (_label, builder) => {
      const authPayload = new AuthPayload(builder().build());
      spacesRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.delete({
          id: faker.number.int(),
          authPayload,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
