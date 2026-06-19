// SPDX-License-Identifier: FSL-1.1-MIT

import { ForbiddenException } from '@nestjs/common';
import { getEnumKey } from '@/domain/common/utils/enum';
import type { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import type { Member } from '@/modules/users/domain/entities/member.entity';
import { MemberRole } from '@/modules/users/domain/entities/member.entity';
import type { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

export async function isAdmin(
  spacesRepository: ISpacesRepository,
  spaceId: Space['id'],
  userId: number,
): Promise<boolean> {
  const space = await spacesRepository.findOne({
    where: {
      id: spaceId,
      members: {
        role: getEnumKey(MemberRole, MemberRole.ADMIN),
        status: 'ACTIVE',
        user: { id: userId },
      },
    },
  });
  return space !== null;
}

export async function assertAdmin(
  spacesRepository: ISpacesRepository,
  spaceId: Space['id'],
  userId: number,
): Promise<void> {
  if (!(await isAdmin(spacesRepository, spaceId, userId))) {
    throw new ForbiddenException('User is not an admin of this workspace');
  }
}

/**
 * Asserts the caller is an ACTIVE member of the space. INVITED (pending)
 * members are rejected, so they cannot access space contents before accepting.
 *
 * @returns the membership row, so callers can derive permissions (e.g. role)
 * without a second query.
 */
export async function assertMember(
  membersRepository: IMembersRepository,
  spaceId: Space['id'],
  userId: number,
): Promise<Member> {
  const member = await membersRepository.findOne({
    user: { id: userId },
    space: { id: spaceId },
    status: 'ACTIVE',
  });

  if (!member) {
    throw new ForbiddenException('User is not a member of this workspace');
  }

  return member;
}
