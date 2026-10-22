// SPDX-License-Identifier: FSL-1.1-MIT

import type { EntityManager, FindOptionsWhere } from 'typeorm';
import { MoreThan } from 'typeorm';
import { Space as DbSpace } from '#/modules/spaces/datasources/spaces/entities/space.entity.db';
import type { Member } from '#/modules/users/datasources/entities/member.entity.db';
import { User as DbUser } from '#/modules/users/datasources/entities/users.entity.db';

// Lock order to avoid deadlocks: user rows, then space rows by ascending id.
export async function lockUserForAdminChange(
  entityManager: EntityManager,
  userId: DbUser['id'],
): Promise<void> {
  await entityManager.findOne(DbUser, {
    where: { id: userId },
    select: { id: true },
    lock: { mode: 'pessimistic_write' },
  });
}
export async function lockSpaceForAdminChange(
  entityManager: EntityManager,
  spaceId: DbSpace['id'],
): Promise<void> {
  await entityManager.findOne(DbSpace, {
    where: { id: spaceId },
    select: { id: true },
    lock: { mode: 'pessimistic_write' },
  });
}

type ActiveAdminCandidate = Pick<Member, 'role' | 'status'> & {
  user: Pick<DbUser, 'id'>;
};

export function isActiveAdmin(
  member: Pick<Member, 'role' | 'status'>,
): boolean {
  return member.role === 'ADMIN' && member.status === 'ACTIVE';
}

// `members` must all belong to one space.
export function isLastActiveAdminOfSpace(args: {
  members: Array<ActiveAdminCandidate>;
  userId: DbUser['id'];
}): boolean {
  const activeAdmins = args.members.filter(isActiveAdmin);

  return activeAdmins.length === 1 && activeAdmins[0].user.id === args.userId;
}

/**
 * Single source of truth for the "active or pending" membership rule: an OR of
 * an ACTIVE member and an INVITED member whose invite has not expired, each
 * AND-ed onto the caller's scoping (e.g. `{ user, space }` or `{ user, role }`).
 *
 * `buildBase` is invoked once per clause so each OR branch gets its own
 * `FindOperator`s. This is required: TypeORM mutates operators in place while
 * building the query, so a single instance shared across both branches (e.g.
 * one `In(roles)` on a transformed enum column) gets transformed twice and
 * corrupts the SQL.
 */
export function activeOrPendingMemberWhere<T extends object>(
  buildBase: () => FindOptionsWhere<T>,
): Array<FindOptionsWhere<T>> {
  return [
    { ...buildBase(), status: 'ACTIVE' },
    {
      ...buildBase(),
      status: 'INVITED',
      inviteExpiresAt: MoreThan(new Date()),
    },
  ] as Array<FindOptionsWhere<T>>;
}
