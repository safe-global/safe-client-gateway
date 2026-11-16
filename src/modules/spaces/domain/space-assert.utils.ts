// SPDX-License-Identifier: FSL-1.1-MIT

import { HttpStatus } from '@nestjs/common';
import { HttpExceptionNoLog } from '#/domain/common/errors/http-exception-no-log.error';
import type { Space } from '#/modules/spaces/datasources/spaces/entities/space.entity.db';
import type { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import type { Member } from '#/modules/users/domain/entities/member.entity';
import type { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';

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
    throw new HttpExceptionNoLog(
      'User is not an admin of this workspace',
      HttpStatus.FORBIDDEN,
    );
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
    throw new HttpExceptionNoLog(
      'User is not a member of this workspace',
      HttpStatus.FORBIDDEN,
    );
  }

  return member;
}

/**
 * Asserts the Safe belongs to the space. Call it after {@link assertMember},
 * so a non-member cannot probe which Safes a space holds, and before any
 * entitlement check, so a disallowed request never reaches the plan.
 */
export async function assertSafeInSpace(
  spaceSafesRepository: ISpaceSafesRepository,
  args: Parameters<ISpaceSafesRepository['existsInSpace']>[0],
): Promise<void> {
  if (!(await spaceSafesRepository.existsInSpace(args))) {
    throw new HttpExceptionNoLog(
      'Safe is not in this workspace',
      HttpStatus.FORBIDDEN,
    );
  }
}
