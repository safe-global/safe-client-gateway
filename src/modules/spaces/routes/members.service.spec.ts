// SPDX-License-Identifier: FSL-1.1-MIT
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { oidcAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { MembersService } from '@/modules/spaces/routes/members.service';
import { memberBuilder } from '@/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import { userBuilder } from '@/modules/users/datasources/entities/__tests__/users.entity.db.builder';
import type { IMembersRepository } from '@/modules/users/domain/members.repository.interface';
import { faker } from '@faker-js/faker';

const MAX_INVITES = 10;

const membersRepositoryMock = {
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
    configurationServiceMock.getOrThrow.mockReturnValue(MAX_INVITES);
    service = new MembersService(
      membersRepositoryMock,
      configurationServiceMock,
    );
  });

  describe('get', () => {
    it('should hide stored email for invited members', async () => {
      const email = faker.internet.email().toLowerCase();
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
});
