// SPDX-License-Identifier: FSL-1.1-MIT
import { UserSchema } from '@/modules/users/domain/entities/user.entity';
import { userBuilder } from '@/modules/users/datasources/entities/__tests__/users.entity.db.builder';
import { faker } from '@faker-js/faker';
import omit from 'lodash/omit';

describe('UserSchema', () => {
  it('should validate a valid User', () => {
    const user = userBuilder().build();

    const result = UserSchema.safeParse(user);

    expect(result.success).toBe(true);
  });

  it.each([
    { field: 'id' as const },
    { field: 'createdAt' as const },
    { field: 'updatedAt' as const },
    { field: 'status' as const },
    { field: 'wallets' as const },
    { field: 'members' as const },
    { field: 'extUserId' as const },
  ])('should not validate a User without $field', ({ field }) => {
    const user = userBuilder().build();

    const result = UserSchema.safeParse(omit(user, field));

    expect(result.success).toBe(false);
  });

  it.each([
    { field: 'id' as const, value: 1.5 },
    { field: 'id' as const, value: faker.string.numeric() },
    { field: 'createdAt' as const, value: faker.date.recent().toISOString() },
    { field: 'updatedAt' as const, value: faker.date.recent().toISOString() },
    { field: 'status' as const, value: faker.word.noun() },
    { field: 'wallets' as const, value: faker.string.alphanumeric() },
    { field: 'members' as const, value: faker.string.alphanumeric() },
  ])('should not validate a User with invalid $field', ({ field, value }) => {
    const user = userBuilder().build();

    const result = UserSchema.safeParse({ ...user, [field]: value });

    expect(result.success).toBe(false);
  });

  describe('status', () => {
    it.each([{ status: 'PENDING' as const }, { status: 'ACTIVE' as const }])(
      'should validate $status status',
      ({ status }) => {
        const user = userBuilder().with('status', status).build();

        const result = UserSchema.safeParse(user);

        expect(result.success).toBe(true);
      },
    );
  });

  describe('extUserId', () => {
    it.each([
      {
        label: 'valid string',
        value: faker.string.alphanumeric({ length: 10 }),
      },
      { label: 'null', value: null },
      { label: 'length 1', value: faker.string.alphanumeric({ length: 1 }) },
      {
        label: 'length 255',
        value: faker.string.alphanumeric({ length: 255 }),
      },
    ])('should allow extUserId with $label', ({ value }) => {
      const user = userBuilder().build();

      const result = UserSchema.safeParse({ ...user, extUserId: value });

      expect(result.success).toBe(true);
    });

    it.each([
      { label: 'empty string', value: '' },
      {
        label: 'length 256',
        value: faker.string.alphanumeric({ length: 256 }),
      },
      { label: 'non-string', value: faker.number.int() },
    ])('should not allow extUserId with $label', ({ value }) => {
      const user = userBuilder().build();

      const result = UserSchema.safeParse({ ...user, extUserId: value });

      expect(result.success).toBe(false);
    });
  });
});
