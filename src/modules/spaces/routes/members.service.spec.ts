// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import {
  oidcAuthPayloadDtoBuilder,
  siweAuthPayloadDtoBuilder,
} from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { MembersService } from '@/modules/spaces/routes/members.service';
import { memberBuilder } from '@/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import { userBuilder } from '@/modules/users/datasources/entities/__tests__/users.entity.db.builder';
import { type IMembersRepository as IMembersRepositoryInterface } from '@/modules/users/domain/members.repository.interface';

const MAX_INVITES = 10;
const INVITE_EXPIRY_SECONDS = 7 * 24 * 60 * 60;
const INVITE_CREATED_AT = new Date('2026-04-24T00:00:00.000Z');
const EXPECTED_INVITE_EXPIRES_AT = new Date(
  INVITE_CREATED_AT.getTime() + INVITE_EXPIRY_SECONDS * 1_000,
);

type MembersRepositoryMock = Pick<
  jest.Mocked<IMembersRepositoryInterface>,
  | 'inviteUsers'
  | 'resendInvite'
  | 'findAuthorizedMembersOrFail'
  | 'findSelfMembershipOrFail'
>;

const membersRepositoryMock: MembersRepositoryMock = {
  inviteUsers: jest.fn(),
  resendInvite: jest.fn(),
  findAuthorizedMembersOrFail: jest.fn(),
  findSelfMembershipOrFail: jest.fn(),
};

const configurationServiceMock: jest.Mocked<IConfigurationService> = {
  get: jest.fn(),
  getOrThrow: jest.fn(),
};

function mockConfiguration(): void {
  configurationServiceMock.get.mockReturnValue(undefined);
  configurationServiceMock.getOrThrow.mockImplementation((key: string) => {
    if (key === 'spaces.maxInvites') return MAX_INVITES;
    if (key === 'spaces.inviteExpirySeconds') return INVITE_EXPIRY_SECONDS;
    throw new Error(`Unexpected configuration key: ${key}`);
  });
}

describe('MembersService', () => {
  let service: MembersService;

  beforeEach(() => {
    jest.resetAllMocks();
    mockConfiguration();
    service = new MembersService(
      membersRepositoryMock as MembersRepositoryMock &
        IMembersRepositoryInterface,
      configurationServiceMock,
    );
  });

  describe('inviteUser', () => {
    it('sets the configured invite expiration', async () => {
      jest.useFakeTimers().setSystemTime(INVITE_CREATED_AT);
      try {
        const authPayload = new AuthPayload(
          oidcAuthPayloadDtoBuilder().build(),
        );
        const spaceId = faker.number.int({ min: 1 });
        const users = [
          {
            email: faker.internet.email().toLowerCase(),
            name: faker.person.firstName(),
            role: 'MEMBER' as const,
          },
        ];

        membersRepositoryMock.inviteUsers.mockResolvedValue([]);

        await service.inviteUser({
          authPayload,
          spaceId,
          inviteUsersDto: { users },
        });

        expect(membersRepositoryMock.inviteUsers).toHaveBeenCalledWith({
          authPayload,
          spaceId,
          users,
          inviteExpiresAt: EXPECTED_INVITE_EXPIRES_AT,
        });
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('resendInvite', () => {
    it('resets the configured invite expiration', async () => {
      jest.useFakeTimers().setSystemTime(INVITE_CREATED_AT);
      try {
        const authPayload = new AuthPayload(
          oidcAuthPayloadDtoBuilder().build(),
        );
        const spaceId = faker.number.int({ min: 1 });
        const userId = faker.number.int({ min: 1 });

        await service.resendInvite({ authPayload, spaceId, userId });

        expect(membersRepositoryMock.resendInvite).toHaveBeenCalledWith({
          authPayload,
          spaceId,
          userId,
          inviteExpiresAt: EXPECTED_INVITE_EXPIRES_AT,
        });
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('get', () => {
    it('returns pending invites with email for active admins', async () => {
      const adminUserId = faker.number.int({ min: 1 });
      const authPayload = new AuthPayload(
        siweAuthPayloadDtoBuilder().with('sub', String(adminUserId)).build(),
      );
      const activeEmail = faker.internet.email().toLowerCase();
      const invitedEmail = faker.internet.email().toLowerCase();
      const activeMember = memberBuilder()
        .with(
          'user',
          userBuilder()
            .with('id', adminUserId)
            .with('email', activeEmail)
            .with('status', 'ACTIVE')
            .build(),
        )
        .with('status', 'ACTIVE')
        .with('role', 'ADMIN')
        .build();
      const invitedMember = memberBuilder()
        .with(
          'user',
          userBuilder()
            .with('email', invitedEmail)
            .with('status', 'PENDING')
            .build(),
        )
        .with('status', 'INVITED')
        .build();

      membersRepositoryMock.findAuthorizedMembersOrFail.mockResolvedValue([
        activeMember,
        invitedMember,
      ]);

      await expect(
        service.get({
          authPayload,
          spaceId: faker.number.int(),
        }),
      ).resolves.toEqual({
        members: [
          expect.objectContaining({
            id: activeMember.id,
            status: 'ACTIVE',
            user: expect.objectContaining({
              id: activeMember.user.id,
              email: activeEmail,
            }),
          }),
          expect.objectContaining({
            id: invitedMember.id,
            status: 'INVITED',
            user: expect.objectContaining({
              id: invitedMember.user.id,
              email: invitedEmail,
            }),
          }),
        ],
      });
    });

    it('hides pending invites from non-admin members', async () => {
      const memberUserId = faker.number.int({ min: 1 });
      const authPayload = new AuthPayload(
        siweAuthPayloadDtoBuilder().with('sub', String(memberUserId)).build(),
      );
      const activeEmail = faker.internet.email().toLowerCase();
      const activeMember = memberBuilder()
        .with(
          'user',
          userBuilder()
            .with('id', memberUserId)
            .with('email', activeEmail)
            .with('status', 'ACTIVE')
            .build(),
        )
        .with('status', 'ACTIVE')
        .with('role', 'MEMBER')
        .build();
      const invitedMember = memberBuilder()
        .with(
          'user',
          userBuilder()
            .with('email', faker.internet.email().toLowerCase())
            .with('status', 'PENDING')
            .build(),
        )
        .with('status', 'INVITED')
        .build();

      membersRepositoryMock.findAuthorizedMembersOrFail.mockResolvedValue([
        activeMember,
        invitedMember,
      ]);

      await expect(
        service.get({
          authPayload,
          spaceId: faker.number.int(),
        }),
      ).resolves.toEqual({
        members: [
          expect.objectContaining({
            id: activeMember.id,
            status: 'ACTIVE',
            user: expect.objectContaining({
              id: activeMember.user.id,
              email: activeEmail,
            }),
          }),
        ],
      });
    });

    it('returns invitee email to active admins', async () => {
      const adminUserId = faker.number.int({ min: 1 });
      const invitedEmail = faker.internet.email().toLowerCase();
      const authPayload = new AuthPayload(
        siweAuthPayloadDtoBuilder().with('sub', String(adminUserId)).build(),
      );
      const adminMember = memberBuilder()
        .with(
          'user',
          userBuilder()
            .with('id', adminUserId)
            .with('status', 'ACTIVE')
            .build(),
        )
        .with('role', 'ADMIN')
        .with('status', 'ACTIVE')
        .build();
      const invitedMember = memberBuilder()
        .with(
          'user',
          userBuilder()
            .with('email', invitedEmail)
            .with('status', 'PENDING')
            .build(),
        )
        .with('status', 'INVITED')
        .build();

      membersRepositoryMock.findAuthorizedMembersOrFail.mockResolvedValue([
        adminMember,
        invitedMember,
      ]);

      await expect(
        service.get({ authPayload, spaceId: faker.number.int() }),
      ).resolves.toEqual({
        members: expect.arrayContaining([
          expect.objectContaining({
            id: invitedMember.id,
            user: expect.objectContaining({ email: invitedEmail }),
          }),
        ]),
      });
    });

    it('does not return invitee email to non-admin members', async () => {
      const memberUserId = faker.number.int({ min: 1 });
      const invitedEmail = faker.internet.email().toLowerCase();
      const authPayload = new AuthPayload(
        siweAuthPayloadDtoBuilder().with('sub', String(memberUserId)).build(),
      );
      const activeMember = memberBuilder()
        .with(
          'user',
          userBuilder()
            .with('id', memberUserId)
            .with('status', 'ACTIVE')
            .build(),
        )
        .with('role', 'MEMBER')
        .with('status', 'ACTIVE')
        .build();
      const invitedMember = memberBuilder()
        .with(
          'user',
          userBuilder()
            .with('email', invitedEmail)
            .with('status', 'PENDING')
            .build(),
        )
        .with('status', 'INVITED')
        .build();

      membersRepositoryMock.findAuthorizedMembersOrFail.mockResolvedValue([
        activeMember,
        invitedMember,
      ]);

      const result = await service.get({
        authPayload,
        spaceId: faker.number.int(),
      });

      expect(result.members).toEqual([
        expect.objectContaining({ id: activeMember.id }),
      ]);
      expect(result.members).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: invitedMember.id,
            user: expect.objectContaining({ email: invitedEmail }),
          }),
        ]),
      );
    });

    it('preserves null email for active members without a stored email', async () => {
      const userId = faker.number.int({ min: 1 });
      const authPayload = new AuthPayload(
        siweAuthPayloadDtoBuilder().with('sub', String(userId)).build(),
      );
      const activeMember = memberBuilder()
        .with(
          'user',
          userBuilder()
            .with('id', userId)
            .with('email', null)
            .with('status', 'ACTIVE')
            .build(),
        )
        .with('status', 'ACTIVE')
        .build();

      membersRepositoryMock.findAuthorizedMembersOrFail.mockResolvedValue([
        activeMember,
      ]);

      await expect(
        service.get({
          authPayload,
          spaceId: faker.number.int(),
        }),
      ).resolves.toEqual({
        members: [
          expect.objectContaining({
            id: activeMember.id,
            status: 'ACTIVE',
            user: expect.objectContaining({
              id: activeMember.user.id,
              email: null,
            }),
          }),
        ],
      });
    });
  });

  describe('getSelfMembership', () => {
    it('returns the stored email for active memberships', async () => {
      const authPayload = new AuthPayload(oidcAuthPayloadDtoBuilder().build());
      const email = faker.internet.email().toLowerCase();
      const member = memberBuilder()
        .with(
          'user',
          userBuilder().with('email', email).with('status', 'ACTIVE').build(),
        )
        .with('status', 'ACTIVE')
        .build();

      membersRepositoryMock.findSelfMembershipOrFail.mockResolvedValue(member);

      await expect(
        service.getSelfMembership({
          authPayload,
          spaceId: faker.number.int(),
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          id: member.id,
          status: 'ACTIVE',
          user: expect.objectContaining({
            id: member.user.id,
            email,
          }),
        }),
      );
    });

    it('returns the stored email for invited self memberships', async () => {
      const authPayload = new AuthPayload(oidcAuthPayloadDtoBuilder().build());
      const email = faker.internet.email().toLowerCase();
      const member = memberBuilder()
        .with(
          'user',
          userBuilder().with('email', email).with('status', 'PENDING').build(),
        )
        .with('status', 'INVITED')
        .build();

      membersRepositoryMock.findSelfMembershipOrFail.mockResolvedValue(member);

      await expect(
        service.getSelfMembership({
          authPayload,
          spaceId: faker.number.int(),
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          id: member.id,
          status: 'INVITED',
          user: expect.objectContaining({
            id: member.user.id,
            email,
          }),
        }),
      );
    });

    it('preserves null for active memberships without a stored email', async () => {
      const authPayload = new AuthPayload(oidcAuthPayloadDtoBuilder().build());
      const member = memberBuilder()
        .with(
          'user',
          userBuilder().with('email', null).with('status', 'ACTIVE').build(),
        )
        .with('status', 'ACTIVE')
        .build();

      membersRepositoryMock.findSelfMembershipOrFail.mockResolvedValue(member);

      await expect(
        service.getSelfMembership({
          authPayload,
          spaceId: faker.number.int(),
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          id: member.id,
          status: 'ACTIVE',
          user: expect.objectContaining({
            id: member.user.id,
            email: null,
          }),
        }),
      );
    });
  });
});
