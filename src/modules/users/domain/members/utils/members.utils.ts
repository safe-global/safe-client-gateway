// SPDX-License-Identifier: FSL-1.1-MIT

import type { FindOptionsWhere } from 'typeorm';
import { MoreThan } from 'typeorm';
import type { Member } from '@/modules/users/datasources/entities/member.entity.db';
import type { User } from '@/modules/users/datasources/entities/users.entity.db';

/**
 * The subset of a member row the active-admin rules read. Kept structural so
 * both a fully loaded row and a relation-limited projection satisfy it.
 */
type ActiveAdminCandidate = Pick<Member, 'role' | 'status'> & {
  user: Pick<User, 'id'>;
};

/**
 * Single source of truth for what makes a member an admin of a space: the role
 * alone is not enough, an `INVITED` or `DECLINED` admin cannot administer
 * anything.
 */
export function isActiveAdmin(
  member: Pick<Member, 'role' | 'status'>,
): boolean {
  return member.role === 'ADMIN' && member.status === 'ACTIVE';
}

/**
 * True when `userId` is the only active admin among `members` - i.e. removing
 * that membership would leave the space with nobody able to administer it.
 *
 * `members` must be the membership rows of a **single** space. The rule counts
 * active admins, so rows from several spaces at once answer a question nobody
 * asked: a user who solely administers two spaces yields two active admins and
 * the function returns `false`, silently reporting the removal as safe. A
 * caller holding rows for more than one space partitions them first - see
 * `UsersRepository.assertIsNotLastAdminOfAnySpace`, which loops per space.
 *
 * Shared by every flow that can drop an admin membership: member removal and
 * self-demotion in `MembersRepository`, and account deletion in
 * `UsersRepository`, whose cascade deletes the row just as directly.
 */
export function isLastActiveAdminOfSpace(args: {
  members: Array<ActiveAdminCandidate>;
  userId: User['id'];
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
