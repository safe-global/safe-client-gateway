// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import {
  oidcAuthPayloadDtoBuilder,
  siweAuthPayloadDtoBuilder,
} from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import type { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import {
  emailInviteUserDtoBuilder,
  walletInviteUserDtoBuilder,
} from '@/modules/spaces/routes/entities/__tests__/invite-user.dto.builder';
import type { InviteUsersDto } from '@/modules/spaces/routes/entities/invite-users.dto.entity';
import { MembersService } from '@/modules/spaces/routes/members.service';
import type { SpaceInviteEmailService } from '@/modules/spaces/routes/space-invite-email.service';
import { memberBuilder } from '@/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import { userBuilder } from '@/modules/users/datasources/entities/__tests__/users.entity.db.builder';
import type { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';
import { fakeEmailAddress } from '@/validation/entities/schemas/__tests__/email-address.builder';
import { fakeUuid } from '@/validation/entities/schemas/__tests__/uuid.builder';

const MAX_INVITES = 10;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const membersRepositoryMock = {
  findActiveAdmin: vi.fn(),
  findAuthorizedMembersOrFail: vi.fn(),
  findOneOrFail: vi.fn(),
  inviteUsers: vi.fn(),
  renewInvite: vi.fn(),
} as MockedObject<IMembersRepository>;

const configurationServiceMock = {
  getOrThrow: vi.fn(),
} as MockedObject<IConfigurationService>;

const spaceInviteEmailServiceMock = {
  enqueueInviteEmails: vi.fn(),
  enqueueRenewalEmail: vi.fn(),
} as MockedObject<SpaceInviteEmailService>;

describe('MembersService', () => {
  let service: MembersService;

  beforeEach(() => {
    vi.resetAllMocks();
    configurationServiceMock.getOrThrow.mockImplementation((key: string) => {
      switch (key) {
        case 'spaces.maxInvites':
          return MAX_INVITES;
        case 'spaces.invite.ttlMs':
          return INVITE_TTL_MS;
        default:
          throw new Error(`Unexpected config key: ${key}`);
      }
    });
    service = new MembersService(
      membersRepositoryMock,
      configurationServiceMock,
      spaceInviteEmailServiceMock,
    );
  });

  describe('get', () => {
    it('should hide stored email for invited members when the caller is not an active admin', async () => {
      const email = fakeEmailAddress();
      const invitedMember = memberBuilder()
        .with('role', 'MEMBER')
        .with('status', 'INVITED')
        .with(
          'user',
          userBuilder().with('email', email).with('status', 'PENDING').build(),
        )
        .build();
      const authPayload = new AuthPayload(oidcAuthPayloadDtoBuilder().build());
      const spaceId = faker.number.int({ min: 1 });

      membersRepositoryMock.findAuthorizedMembersOrFail.mockResolvedValue([
        invitedMember,
      ]);
      membersRepositoryMock.findActiveAdmin.mockResolvedValue(null);

      await expect(service.get({ authPayload, spaceId })).resolves.toEqual({
        members: [
          {
            ...invitedMember,
            user: {
              id: invitedMember.user.id,
              status: invitedMember.user.status,
              email: null,
            },
          },
        ],
      });
      expect(membersRepositoryMock.findActiveAdmin).toHaveBeenCalledWith({
        userId: Number(authPayload.sub),
        spaceId,
      });
    });

    it('should expose stored email for invited members when the caller is an active admin', async () => {
      const email = fakeEmailAddress();
      const invitedMember = memberBuilder()
        .with('role', 'MEMBER')
        .with('status', 'INVITED')
        .with(
          'user',
          userBuilder().with('email', email).with('status', 'PENDING').build(),
        )
        .build();
      const authPayload = new AuthPayload(oidcAuthPayloadDtoBuilder().build());
      const callerMember = memberBuilder()
        .with('role', 'ADMIN')
        .with('status', 'ACTIVE')
        .with('user', userBuilder().with('id', Number(authPayload.sub)).build())
        .build();
      const spaceId = faker.number.int({ min: 1 });

      membersRepositoryMock.findAuthorizedMembersOrFail.mockResolvedValue([
        callerMember,
        invitedMember,
      ]);
      membersRepositoryMock.findActiveAdmin.mockResolvedValue(callerMember);

      await expect(service.get({ authPayload, spaceId })).resolves.toEqual({
        members: [
          {
            ...callerMember,
            user: {
              id: callerMember.user.id,
              status: callerMember.user.status,
              email: callerMember.user.email,
            },
          },
          {
            ...invitedMember,
            user: {
              id: invitedMember.user.id,
              status: invitedMember.user.status,
              email,
            },
          },
        ],
      });
    });

    it('should not expose extUserId in the member user', async () => {
      const invitedMember = memberBuilder()
        .with('role', 'MEMBER')
        .with('status', 'INVITED')
        .with(
          'user',
          userBuilder()
            .with('extUserId', faker.string.uuid())
            .with('status', 'PENDING')
            .build(),
        )
        .build();
      const authPayload = new AuthPayload(oidcAuthPayloadDtoBuilder().build());
      const spaceId = faker.number.int({ min: 1 });

      membersRepositoryMock.findAuthorizedMembersOrFail.mockResolvedValue([
        invitedMember,
      ]);
      membersRepositoryMock.findActiveAdmin.mockResolvedValue(null);

      const result = await service.get({ authPayload, spaceId });

      expect(result.members[0].user).not.toHaveProperty('extUserId');
    });
  });

  describe('inviteUser', () => {
    it('should throw when the caller is not authenticated', async () => {
      const authPayload = new AuthPayload();
      const spaceId = faker.number.int({ min: 1 });
      const inviteUsersDto: InviteUsersDto = { users: [] };

      await expect(
        service.inviteUser({ authPayload, spaceId, inviteUsersDto }),
      ).rejects.toThrow('Not authenticated');
      expect(membersRepositoryMock.findActiveAdmin).not.toHaveBeenCalled();
      expect(membersRepositoryMock.inviteUsers).not.toHaveBeenCalled();
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder],
      ['OIDC', oidcAuthPayloadDtoBuilder],
    ] as const)('should throw ForbiddenException for the %s caller when findActiveAdmin returns null', async (_label, builder) => {
      const authPayload = new AuthPayload(builder().build());
      const spaceId = faker.number.int({ min: 1 });
      const inviteUsersDto: InviteUsersDto = { users: [] };

      membersRepositoryMock.findActiveAdmin.mockResolvedValue(null);

      await expect(
        service.inviteUser({ authPayload, spaceId, inviteUsersDto }),
      ).rejects.toThrow(new ForbiddenException('User is not an active admin.'));
      expect(membersRepositoryMock.inviteUsers).not.toHaveBeenCalled();
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder],
      ['OIDC', oidcAuthPayloadDtoBuilder],
    ] as const)('should call inviteUsers when the %s caller is an active admin', async (_label, builder) => {
      const authPayload = new AuthPayload(builder().build());
      const spaceId = faker.number.int({ min: 1 });
      const inviteUsersDto: InviteUsersDto = { users: [] };
      const adminMember = memberBuilder()
        .with('role', 'ADMIN')
        .with('status', 'ACTIVE')
        .build();
      const now = new Date('2026-01-15T00:00:00Z');
      vi.useFakeTimers().setSystemTime(now);

      membersRepositoryMock.findActiveAdmin.mockResolvedValue(adminMember);
      membersRepositoryMock.inviteUsers.mockResolvedValue([]);

      try {
        await expect(
          service.inviteUser({ authPayload, spaceId, inviteUsersDto }),
        ).resolves.toEqual([]);
        expect(membersRepositoryMock.findActiveAdmin).toHaveBeenCalled();
        expect(membersRepositoryMock.inviteUsers).toHaveBeenCalledWith({
          authPayload,
          spaceId,
          users: [],
          inviteExpiresAt: new Date(now.getTime() + INVITE_TTL_MS),
        });
        expect(
          spaceInviteEmailServiceMock.enqueueInviteEmails,
        ).toHaveBeenCalledWith({ users: [], spaceId });
      } finally {
        vi.useRealTimers();
      }
    });

    it('should delegate invite email sending to the SpaceInviteEmailService', async () => {
      const authPayload = new AuthPayload(oidcAuthPayloadDtoBuilder().build());
      const spaceId = faker.number.int({ min: 1 });
      const emailInvite = emailInviteUserDtoBuilder().build();
      const walletInvite = walletInviteUserDtoBuilder().build();
      const inviteUsersDto: InviteUsersDto = {
        users: [emailInvite, walletInvite],
      };
      const adminMember = memberBuilder()
        .with('role', 'ADMIN')
        .with('status', 'ACTIVE')
        .build();
      const spaceUuid = fakeUuid();
      const emailInvitation = {
        userId: faker.number.int({ min: 1 }),
        spaceId,
        spaceUuid,
        name: emailInvite.name,
        role: emailInvite.role,
        status: 'INVITED' as const,
        invitedBy: Number(authPayload.sub),
      };
      const walletInvitation = {
        userId: faker.number.int({ min: 1 }),
        spaceId,
        spaceUuid,
        name: walletInvite.name,
        role: walletInvite.role,
        status: 'INVITED' as const,
        invitedBy: Number(authPayload.sub),
      };
      const invitations = [emailInvitation, walletInvitation];
      membersRepositoryMock.findActiveAdmin.mockResolvedValue(adminMember);
      membersRepositoryMock.inviteUsers.mockResolvedValue(invitations);

      await expect(
        service.inviteUser({ authPayload, spaceId, inviteUsersDto }),
      ).resolves.toEqual(invitations);

      expect(
        spaceInviteEmailServiceMock.enqueueInviteEmails,
      ).toHaveBeenCalledTimes(1);
      expect(
        spaceInviteEmailServiceMock.enqueueInviteEmails,
      ).toHaveBeenCalledWith({ users: inviteUsersDto.users, spaceId });
    });
  });

  describe('renewInvite', () => {
    it('should throw ForbiddenException when the caller is not an active admin', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const spaceId = faker.number.int({ min: 1 });
      const userId = faker.number.int({ min: 1 });

      membersRepositoryMock.findActiveAdmin.mockResolvedValue(null);

      await expect(
        service.renewInvite({ authPayload, spaceId, userId }),
      ).rejects.toThrow(new ForbiddenException('User is not an active admin.'));
      expect(membersRepositoryMock.findOneOrFail).not.toHaveBeenCalled();
      expect(membersRepositoryMock.renewInvite).not.toHaveBeenCalled();
    });

    it('should propagate NotFoundException when the member does not exist', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const spaceId = faker.number.int({ min: 1 });
      const userId = faker.number.int({ min: 1 });
      const adminMember = memberBuilder()
        .with('role', 'ADMIN')
        .with('status', 'ACTIVE')
        .build();

      membersRepositoryMock.findActiveAdmin.mockResolvedValue(adminMember);
      membersRepositoryMock.findOneOrFail.mockRejectedValue(
        new NotFoundException('Member not found.'),
      );

      await expect(
        service.renewInvite({ authPayload, spaceId, userId }),
      ).rejects.toThrow(new NotFoundException('Member not found.'));
      expect(membersRepositoryMock.renewInvite).not.toHaveBeenCalled();
    });

    it.each([
      'ACTIVE',
      'DECLINED',
    ] as const)('should throw ConflictException without renewing when the member is %s', async (status) => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const spaceId = faker.number.int({ min: 1 });
      const userId = faker.number.int({ min: 1 });
      const adminMember = memberBuilder()
        .with('role', 'ADMIN')
        .with('status', 'ACTIVE')
        .build();
      const targetMember = memberBuilder().with('status', status).build();

      membersRepositoryMock.findActiveAdmin.mockResolvedValue(adminMember);
      membersRepositoryMock.findOneOrFail.mockResolvedValue(targetMember);

      await expect(
        service.renewInvite({ authPayload, spaceId, userId }),
      ).rejects.toThrow(
        new ConflictException('Only a pending invitation can be renewed.'),
      );
      expect(membersRepositoryMock.renewInvite).not.toHaveBeenCalled();
    });

    it('should renew the invite and return the preserved invitation metadata', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const spaceId = faker.number.int({ min: 1 });
      const userId = faker.number.int({ min: 1 });
      const spaceUuid = fakeUuid();
      const targetMember = memberBuilder()
        .with('status', 'INVITED')
        .with('role', 'MEMBER')
        .with('space', { id: spaceId, uuid: spaceUuid } as Space)
        .build();
      const adminMember = memberBuilder()
        .with('role', 'ADMIN')
        .with('status', 'ACTIVE')
        .build();
      const now = new Date('2026-01-15T00:00:00Z');
      vi.useFakeTimers().setSystemTime(now);

      membersRepositoryMock.findActiveAdmin.mockResolvedValue(adminMember);
      membersRepositoryMock.findOneOrFail.mockResolvedValue(targetMember);

      try {
        await expect(
          service.renewInvite({ authPayload, spaceId, userId }),
        ).resolves.toEqual({
          userId,
          spaceUuid,
          name: targetMember.name,
          role: targetMember.role,
          status: 'INVITED',
          invitedBy: targetMember.invitedBy,
        });
        expect(membersRepositoryMock.renewInvite).toHaveBeenCalledWith({
          memberId: targetMember.id,
          inviteExpiresAt: new Date(now.getTime() + INVITE_TTL_MS),
          spaceId,
          spaceUuid,
          targetUserId: userId,
          actorUserId: Number(authPayload.sub),
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('should load the member with its user relation', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const spaceId = faker.number.int({ min: 1 });
      const userId = faker.number.int({ min: 1 });
      const targetMember = memberBuilder().with('status', 'INVITED').build();
      const adminMember = memberBuilder()
        .with('role', 'ADMIN')
        .with('status', 'ACTIVE')
        .build();

      membersRepositoryMock.findActiveAdmin.mockResolvedValue(adminMember);
      membersRepositoryMock.findOneOrFail.mockResolvedValue(targetMember);

      await service.renewInvite({ authPayload, spaceId, userId });

      expect(membersRepositoryMock.findOneOrFail).toHaveBeenCalledWith(
        { user: { id: userId }, space: { id: spaceId } },
        { user: true, space: true },
      );
    });

    it('should enqueue a renewal email when the invited member has an email', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const spaceId = faker.number.int({ min: 1 });
      const userId = faker.number.int({ min: 1 });
      const email = fakeEmailAddress();
      const targetMember = memberBuilder()
        .with('status', 'INVITED')
        .with('role', 'MEMBER')
        .with('user', userBuilder().with('email', email).build())
        .build();
      const adminMember = memberBuilder()
        .with('role', 'ADMIN')
        .with('status', 'ACTIVE')
        .build();

      membersRepositoryMock.findActiveAdmin.mockResolvedValue(adminMember);
      membersRepositoryMock.findOneOrFail.mockResolvedValue(targetMember);

      await service.renewInvite({ authPayload, spaceId, userId });

      expect(
        spaceInviteEmailServiceMock.enqueueRenewalEmail,
      ).toHaveBeenCalledTimes(1);
      expect(
        spaceInviteEmailServiceMock.enqueueRenewalEmail,
      ).toHaveBeenCalledWith({
        name: targetMember.name,
        email,
        spaceId,
      });
    });

    it('should not enqueue a renewal email when the invited member has no email', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const spaceId = faker.number.int({ min: 1 });
      const userId = faker.number.int({ min: 1 });
      const targetMember = memberBuilder()
        .with('status', 'INVITED')
        .with('role', 'MEMBER')
        .with('user', userBuilder().with('email', null).build())
        .build();
      const adminMember = memberBuilder()
        .with('role', 'ADMIN')
        .with('status', 'ACTIVE')
        .build();

      membersRepositoryMock.findActiveAdmin.mockResolvedValue(adminMember);
      membersRepositoryMock.findOneOrFail.mockResolvedValue(targetMember);

      await service.renewInvite({ authPayload, spaceId, userId });

      expect(membersRepositoryMock.renewInvite).toHaveBeenCalledTimes(1);
      expect(
        spaceInviteEmailServiceMock.enqueueRenewalEmail,
      ).not.toHaveBeenCalled();
    });
  });
});
