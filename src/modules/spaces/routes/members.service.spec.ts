// SPDX-License-Identifier: FSL-1.1-MIT
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { type IMembersRepository as IMembersRepositoryInterface } from '@/modules/users/domain/members.repository.interface';
import { MembersService } from '@/modules/spaces/routes/members.service';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { memberBuilder } from '@/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import { userBuilder } from '@/modules/users/datasources/entities/__tests__/users.entity.db.builder';
import {
  oidcAuthPayloadDtoBuilder,
  siweAuthPayloadDtoBuilder,
} from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { faker } from '@faker-js/faker';

const membersRepositoryMock: jest.Mocked<IMembersRepositoryInterface> = {
  findOneOrFail: jest.fn(),
  findOne: jest.fn(),
  findOrFail: jest.fn(),
  find: jest.fn(),
  inviteUsers: jest.fn(),
  acceptInvite: jest.fn(),
  declineInvite: jest.fn(),
  findAuthorizedMembersOrFail: jest.fn(),
  findSelfMembershipOrFail: jest.fn(),
  updateRole: jest.fn(),
  updateAlias: jest.fn(),
  removeUser: jest.fn(),
  removeSelf: jest.fn(),
};

const configurationServiceMock = {
  getOrThrow: jest.fn().mockReturnValue(10),
} as jest.MockedObjectDeep<IConfigurationService>;

describe('MembersService', () => {
  let service: MembersService;

  beforeEach(() => {
    jest.resetAllMocks();
    configurationServiceMock.getOrThrow.mockReturnValue(10);
    service = new MembersService(
      membersRepositoryMock,
      configurationServiceMock,
    );
  });

  describe('get', () => {
    it('returns email for active members only', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const activeEmail = faker.internet.email().toLowerCase();
      const invitedEmail = faker.internet.email().toLowerCase();
      const activeMember = memberBuilder()
        .with(
          'user',
          userBuilder()
            .with('email', activeEmail)
            .with('status', 'ACTIVE')
            .build(),
        )
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
              email: null,
            }),
          }),
        ],
      });
    });

    it('preserves null email for active members without a stored email', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const activeMember = memberBuilder()
        .with(
          'user',
          userBuilder().with('email', null).with('status', 'ACTIVE').build(),
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

    it('redacts email for invited memberships', async () => {
      const authPayload = new AuthPayload(oidcAuthPayloadDtoBuilder().build());
      const member = memberBuilder()
        .with(
          'user',
          userBuilder()
            .with('email', faker.internet.email().toLowerCase())
            .with('status', 'PENDING')
            .build(),
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
            email: null,
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
