// SPDX-License-Identifier: FSL-1.1-MIT

import type { FindOptionsWhere } from 'typeorm';
import { MoreThan } from 'typeorm';

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
