// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { ForbiddenException } from '@nestjs/common';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import {
  oidcAuthPayloadDtoBuilder,
  siweAuthPayloadDtoBuilder,
} from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import type { InviteUsersDto } from '@/modules/spaces/routes/entities/invite-users.dto.entity';
import { MembersService } from '@/modules/spaces/routes/members.service';
import { memberBuilder } from '@/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import { userBuilder } from '@/modules/users/datasources/entities/__tests__/users.entity.db.builder';
import type { IMembersRepository } from '@/modules/users/domain/members.repository.interface';
import { fakeEmailAddress } from '@/validation/entities/schemas/__tests__/email-address.builder';

const MAX_INVITES = 10;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const membersRepositoryMock = {
  findActiveAdmin: jest.fn(),
  findAuthorizedMembersOrFail: jest.fn(),
  inviteUsers: jest.fn(),
} as jest.MockedObjectDeep<IMembersRepository>;

const configurationServiceMock = {
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;

describe('MembersService', () => {
  let service: MembersService;

  beforeEach(() => {
    jest.resetAllMocks();
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
    );
  });

  describe('get', () => {
    it('should hide stored email for invited members', async () => {
      const email = fakeEmailAddress();
      const member = memberBuilder()
        .with('status', 'INVITED')
        .with(
          'user',
          userBuilder().with('email', email).with('status', 'PENDING').build(),
        )
        .build();
      const authPayload = new AuthPayload(oidcAuthPayloadDtoBuilder().build());
      const spaceId = faker.number.int({ min: 1 });

      membersRepositoryMock.findAuthorizedMembersOrFail.mockResolvedValue([
        member,
      ]);

      await expect(service.get({ authPayload, spaceId })).resolves.toEqual({
        members: [
          {
            ...member,
            user: {
              ...member.user,
              email: null,
            },
          },
        ],
      });
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
      jest.useFakeTimers().setSystemTime(now);

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
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
