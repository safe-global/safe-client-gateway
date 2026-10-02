// SPDX-License-Identifier: FSL-1.1-MIT

import type { EntityManager, FindOptionsWhere } from 'typeorm';
import { MoreThan } from 'typeorm';
import { Space as DbSpace } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import type { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { User as DbUser } from '@/modules/users/datasources/entities/users.entity.db';

/**
 * Locks needed by the paths that can drop an admin membership, so two of them
 * cannot check the same pre-change admin list and both conclude they are safe.
 *
 * **Ordering, for any new path:** user rows first, then space rows, spaces in
 * ascending id order. Nothing may hold a space row and then wait on a user row
 * - that is the only shape that could deadlock these two against each other.
 *
 * Both must run inside a transaction, and load no relations: Postgres refuses
 * `FOR UPDATE` on the nullable side of an outer join. A missing row is not an
 * error here; the caller's own read reports it.
 */
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
/** See {@link lockUserForAdminChange} for the ordering rule both share. */
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

/**
 * The subset of a member row the active-admin rules read. Kept structural so
 * both a fully loaded row and a relation-limited projection satisfy it.
 */
type ActiveAdminCandidate = Pick<Member, 'role' | 'status'> & {
  user: Pick<DbUser, 'id'>;
};

/** An `INVITED` or `DECLINED` admin administers nothing, so status counts too. */
export function isActiveAdmin(
  member: Pick<Member, 'role' | 'status'>,
): boolean {
  return member.role === 'ADMIN' && member.status === 'ACTIVE';
}

/**
 * True when removing `userId`'s membership would leave the space with no admin.
 *
 * `members` must come from a **single** space: the rule counts active admins,
 * so rows spanning two spaces yield two and this returns `false` - wrongly
 * reporting the removal as safe. Callers holding more than one space partition
 * first (see `UsersRepository.assertIsNotLastAdminOfAnySpace`).
 */
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
