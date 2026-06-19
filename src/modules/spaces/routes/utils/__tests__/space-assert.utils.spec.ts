// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { ForbiddenException } from '@nestjs/common';
import { spaceBuilder } from '@/modules/spaces/domain/entities/__tests__/space.entity.db.builder';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import {
  assertAdmin,
  assertMember,
} from '@/modules/spaces/routes/utils/space-assert.utils';
import { memberBuilder } from '@/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import type { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

const spacesRepositoryMock = {
  findOne: jest.fn(),
} as jest.MockedObjectDeep<ISpacesRepository>;

const membersRepositoryMock = {
  findOne: jest.fn(),
} as jest.MockedObjectDeep<IMembersRepository>;

describe('space-assert.utils', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('assertAdmin', () => {
    it('should resolve when user is admin', async () => {
      const spaceId = faker.number.int();
      const userId = faker.number.int();

      spacesRepositoryMock.findOne.mockResolvedValue(spaceBuilder().build());

      await expect(
        assertAdmin(spacesRepositoryMock, spaceId, userId),
      ).resolves.toBeUndefined();

      expect(spacesRepositoryMock.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: spaceId,
            members: expect.objectContaining({
              user: { id: userId },
            }),
          }),
        }),
      );
    });

    it('should throw ForbiddenException when user is not admin', async () => {
      spacesRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        assertAdmin(
          spacesRepositoryMock,
          faker.number.int(),
          faker.number.int(),
        ),
      ).rejects.toThrow(
        new ForbiddenException('User is not an admin of this workspace'),
      );
    });
  });

  describe('assertMember', () => {
    it('should return the membership row when user is an active member', async () => {
      const spaceId = faker.number.int();
      const userId = faker.number.int();
      const member = memberBuilder().build();

      membersRepositoryMock.findOne.mockResolvedValue(member);

      await expect(
        assertMember(membersRepositoryMock, spaceId, userId),
      ).resolves.toBe(member);

      expect(membersRepositoryMock.findOne).toHaveBeenCalledWith({
        user: { id: userId },
        space: { id: spaceId },
        status: 'ACTIVE',
      });
    });

    it('should throw ForbiddenException for a pending member', async () => {
      // findOne is queried with status ACTIVE only, so a pending invite yields null
      membersRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        assertMember(
          membersRepositoryMock,
          faker.number.int(),
          faker.number.int(),
        ),
      ).rejects.toThrow(
        new ForbiddenException('User is not a member of this workspace'),
      );
    });

    it('should throw ForbiddenException when user is not member', async () => {
      membersRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        assertMember(
          membersRepositoryMock,
          faker.number.int(),
          faker.number.int(),
        ),
      ).rejects.toThrow(
        new ForbiddenException('User is not a member of this workspace'),
      );
    });
  });
});
