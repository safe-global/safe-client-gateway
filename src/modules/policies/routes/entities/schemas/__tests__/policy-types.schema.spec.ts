// SPDX-License-Identifier: FSL-1.1-MIT
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import { PolicyTypesSchema } from '@/modules/policies/routes/entities/schemas/policy-types.schema';

describe('PolicyTypesSchema', () => {
  it('should parse a single type', () => {
    expect(PolicyTypesSchema.parse('spending-limit')).toStrictEqual([
      PolicyType.SpendingLimit,
    ]);
  });

  it('should parse a comma-separated list, in the order asked for', () => {
    expect(PolicyTypesSchema.parse('proposer,spending-limit')).toStrictEqual([
      PolicyType.Proposer,
      PolicyType.SpendingLimit,
    ]);
  });

  it('should accept a type nothing reports yet', () => {
    // It names a real policy kind, so the honest answer is an empty list rather
    // than a 422 telling the caller the type does not exist.
    expect(PolicyTypesSchema.parse('recovery')).toStrictEqual([
      PolicyType.Recovery,
    ]);
  });

  it('should accept every type it supports', () => {
    const everyType = Object.values(PolicyType);

    expect(PolicyTypesSchema.parse(everyType.join(','))).toStrictEqual(
      everyType,
    );
  });

  it.each([
    ['an empty value', ''],
    ['a value that is not a policy type', 'nope'],
    ['one bad entry among good ones', 'spending-limit,nope'],
    ['a trailing separator', 'spending-limit,'],
    ['a type in another casing', 'Spending-Limit'],
  ])('should not validate %s', (_, value) => {
    expect(PolicyTypesSchema.safeParse(value).success).toBe(false);
  });

  it('should name the value it rejected', () => {
    const result = PolicyTypesSchema.safeParse('spending-limit,nope');

    expect(!result.success && result.error.issues[0]).toMatchObject({
      path: [1],
    });
  });
});
