// SPDX-License-Identifier: FSL-1.1-MIT

import { ForbiddenException } from '@nestjs/common';
import type { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import type { Member } from '@/modules/users/domain/entities/member.entity';
import type { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

/**
 * Asserts the caller is an ACTIVE ADMIN of the space. Non-members, pending
 * (INVITED) members and active MEMBERs are all rejected alike.
 *
 * @returns the membership row, so callers needing it do not query twice.
 */
export async function assertAdmin(
  membersRepository: IMembersRepository,
  spaceId: Space['id'],
  userId: number,
): Promise<Member> {
  const admin = await membersRepository.findOne({
    user: { id: userId },
    space: { id: spaceId },
    status: 'ACTIVE',
    role: 'ADMIN',
  });

  if (!admin) {
    throw new ForbiddenException('User is not an admin of this workspace');
  }

  return admin;
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
