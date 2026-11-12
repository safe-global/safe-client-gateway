// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { ForbiddenException, HttpStatus } from '@nestjs/common';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { HttpExceptionNoLog } from '#/domain/common/errors/http-exception-no-log.error';
import type { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import {
  assertAdmin,
  assertMember,
  assertSafeInSpace,
} from '#/modules/spaces/domain/space-assert.utils';
import { memberBuilder } from '#/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import type { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';

const membersRepositoryMock = {
  findOne: vi.fn(),
} as MockedObject<IMembersRepository>;

const spaceSafesRepositoryMock = {
  existsInSpace: vi.fn(),
} as MockedObject<ISpaceSafesRepository>;

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

  describe('assertSafeInSpace', () => {
    const args = {
      spaceId: faker.number.int(),
      chainId: faker.string.numeric(),
      address: getAddress(faker.finance.ethereumAddress()),
    };

    it('should resolve when the Safe is in the space', async () => {
      spaceSafesRepositoryMock.existsInSpace.mockResolvedValue(true);

      await expect(
        assertSafeInSpace(spaceSafesRepositoryMock, args),
      ).resolves.toBeUndefined();

      expect(
        spaceSafesRepositoryMock.existsInSpace,
      ).toHaveBeenCalledExactlyOnceWith(args);
    });

    it('should throw an unlogged 403 when the Safe is not in the space', async () => {
      spaceSafesRepositoryMock.existsInSpace.mockResolvedValue(false);

      await expect(
        assertSafeInSpace(spaceSafesRepositoryMock, args),
      ).rejects.toThrow(
        new HttpExceptionNoLog(
          'Safe is not in this workspace',
          HttpStatus.FORBIDDEN,
        ),
      );
    });
  });
});
