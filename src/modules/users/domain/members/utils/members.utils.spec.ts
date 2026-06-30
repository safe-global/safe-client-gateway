// SPDX-License-Identifier: FSL-1.1-MIT

import { In, MoreThan } from 'typeorm';
import type { Member } from '@/modules/users/domain/entities/member.entity';
import { activeOrPendingMemberWhere } from '@/modules/users/domain/members/utils/members.utils';

describe('activeOrPendingMemberWhere', () => {
  it('returns an ACTIVE clause and an unexpired-INVITED clause AND-ed onto the base', () => {
    const where = activeOrPendingMemberWhere<Member>(() => ({
      user: { id: 1 },
      space: { id: 2 },
    }));

    expect(where).toEqual([
      { user: { id: 1 }, space: { id: 2 }, status: 'ACTIVE' },
      {
        user: { id: 1 },
        space: { id: 2 },
        status: 'INVITED',
        inviteExpiresAt: MoreThan(expect.any(Date)),
      },
    ]);
  });

  it('does not leak state between the two clauses', () => {
    const where = activeOrPendingMemberWhere<Member>(() => ({
      user: { id: 1 },
    }));

    expect(where[0]).not.toHaveProperty('inviteExpiresAt');
    expect(where[1]).toHaveProperty('inviteExpiresAt');
  });

  it('evaluates the expiry boundary at call time', () => {
    const before = new Date();
    const [, invited] = activeOrPendingMemberWhere<Member>(() => ({
      user: { id: 1 },
    }));
    const after = new Date();

    // MoreThan wraps the boundary value; assert it was captured "now".
    const boundary = (invited.inviteExpiresAt as { value: Date }).value;
    expect(boundary.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(boundary.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  // Regression: TypeORM mutates FindOperator instances in place while building
  // a query. If the two OR clauses shared a single operator (e.g. one `In(...)`
  // on an enum column with a value transformer), it would be transformed twice
  // and corrupt the SQL. Each clause must own a distinct instance.
  it('builds a fresh base per clause so operators are not shared across clauses', () => {
    const where = activeOrPendingMemberWhere<Member>(() => ({
      user: { id: 1 },
      role: In(['ADMIN']),
    }));

    const activeRole = (where[0] as { role: unknown }).role;
    const invitedRole = (where[1] as { role: unknown }).role;
    expect(activeRole).not.toBe(invitedRole);
  });
});
