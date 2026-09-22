// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { ForbiddenException } from '@nestjs/common';
import type { MockedObject } from 'vitest';
import {
  assertAdmin,
  assertMember,
} from '@/modules/spaces/domain/space-assert.utils';
import { memberBuilder } from '@/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import type { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

const membersRepositoryMock = {
  findOne: vi.fn(),
} as MockedObject<IMembersRepository>;

describe('space-assert.utils', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('assertAdmin', () => {
    it('should return the membership row when user is an active admin', async () => {
      const spaceId = faker.number.int();
      const userId = faker.number.int();
      const member = memberBuilder()
        .with('role', 'ADMIN')
        .with('status', 'ACTIVE')
        .build();

      membersRepositoryMock.findOne.mockResolvedValue(member);

      await expect(
        assertAdmin(membersRepositoryMock, spaceId, userId),
      ).resolves.toBe(member);

      expect(membersRepositoryMock.findOne).toHaveBeenCalledWith({
        user: { id: userId },
        space: { id: spaceId },
        status: 'ACTIVE',
        role: 'ADMIN',
      });
    });

    it('should throw ForbiddenException when user is not admin', async () => {
      // findOne is queried with role ADMIN and status ACTIVE, so a MEMBER,
      // a pending admin and a non-member all yield null
      membersRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        assertAdmin(
          membersRepositoryMock,
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
