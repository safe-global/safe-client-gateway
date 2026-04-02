// SPDX-License-Identifier: FSL-1.1-MIT
import type { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import type { IMembersRepository } from '@/modules/users/domain/members.repository.interface';
import { getEnumKey } from '@/domain/common/utils/enum';
import { MemberRole } from '@/modules/users/domain/entities/member.entity';
import { ForbiddenException } from '@nestjs/common';
import { In } from 'typeorm';

export async function assertAdmin(
  spacesRepository: ISpacesRepository,
  spaceId: Space['id'],
  userId: number,
): Promise<void> {
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

  if (!space) {
    throw new ForbiddenException('User is not an admin of this space');
  }
}

export async function assertMember(
  membersRepository: IMembersRepository,
  spaceId: Space['id'],
  userId: number,
): Promise<void> {
  const member = await membersRepository.findOne({
    user: { id: userId },
    space: { id: spaceId },
    status: In(['ACTIVE', 'INVITED']),
  });

  if (!member) {
    throw new ForbiddenException('User is not a member of this space');
  }
}
