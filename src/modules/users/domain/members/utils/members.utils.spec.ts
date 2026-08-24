// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { In, MoreThan } from 'typeorm';
import { memberBuilder } from '@/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import type { Member as DbMember } from '@/modules/users/datasources/entities/member.entity.db';
import type { User } from '@/modules/users/datasources/entities/users.entity.db';
import type { Member } from '@/modules/users/domain/entities/member.entity';
import {
  activeOrPendingMemberWhere,
  isActiveAdmin,
  isLastActiveAdmin,
} from '@/modules/users/domain/members/utils/members.utils';

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

describe('isActiveAdmin', () => {
  it.each([
    { role: 'ADMIN', status: 'ACTIVE', expected: true },
    { role: 'ADMIN', status: 'INVITED', expected: false },
    { role: 'ADMIN', status: 'DECLINED', expected: false },
    { role: 'MEMBER', status: 'ACTIVE', expected: false },
    { role: 'MEMBER', status: 'INVITED', expected: false },
    { role: 'MEMBER', status: 'DECLINED', expected: false },
  ] as const)(
    'is $expected for a $status $role',
    ({ role, status, expected }) => {
      const member = memberBuilder()
        .with('role', role)
        .with('status', status)
        .build();

      expect(isActiveAdmin(member)).toBe(expected);
    },
  );
});

describe('isLastActiveAdmin', () => {
  const activeAdminOf = (userId: User['id']): DbMember =>
    memberBuilder()
      .with('role', 'ADMIN')
      .with('status', 'ACTIVE')
      .with('user', { id: userId } as User)
      .build();

  it('is true when the user is the only active admin', () => {
    const userId = faker.number.int();

    expect(
      isLastActiveAdmin({ members: [activeAdminOf(userId)], userId }),
    ).toBe(true);
  });

  it('is false when no members are given', () => {
    expect(isLastActiveAdmin({ members: [], userId: faker.number.int() })).toBe(
      false,
    );
  });

  it('is false when the only active admin is someone else', () => {
    const [userId, otherUserId] = faker.helpers.uniqueArray(
      () => faker.number.int(),
      2,
    );

    expect(
      isLastActiveAdmin({ members: [activeAdminOf(otherUserId)], userId }),
    ).toBe(false);
  });

  it('is false when a second active admin remains', () => {
    const [userId, otherUserId] = faker.helpers.uniqueArray(
      () => faker.number.int(),
      2,
    );

    expect(
      isLastActiveAdmin({
        members: [activeAdminOf(userId), activeAdminOf(otherUserId)],
        userId,
      }),
    ).toBe(false);
  });

  // The rule counts active admins, not members: an admin who has not accepted
  // their invite cannot administer the space, so it does not keep the space
  // administrable once this user leaves.
  it('ignores non-active admins and active non-admins when counting', () => {
    const [userId, invitedAdminId, activeMemberId] = faker.helpers.uniqueArray(
      () => faker.number.int(),
      3,
    );
    const invitedAdmin = memberBuilder()
      .with('role', 'ADMIN')
      .with('status', 'INVITED')
      .with('user', { id: invitedAdminId } as User)
      .build();
    const activeMember = memberBuilder()
      .with('role', 'MEMBER')
      .with('status', 'ACTIVE')
      .with('user', { id: activeMemberId } as User)
      .build();

    expect(
      isLastActiveAdmin({
        members: [activeAdminOf(userId), invitedAdmin, activeMember],
        userId,
      }),
    ).toBe(true);
  });
});
