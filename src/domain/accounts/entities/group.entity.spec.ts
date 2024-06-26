import { groupBuilder } from '@/domain/accounts/entities/__tests__/group.builder';
import { GroupSchema } from '@/domain/accounts/entities/group.entity';
import { faker } from '@faker-js/faker';

describe('GroupSchema', () => {
  it('should verify a Group', () => {
    const group = groupBuilder().build();

    const result = GroupSchema.safeParse(group);

    expect(result.success).toBe(true);
  });

  it('should not verify a Group with a float id', () => {
    const group = groupBuilder().with('id', faker.number.float()).build();

    const result = GroupSchema.safeParse(group);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'integer',
        message: 'Expected integer, received float',
        path: ['id'],
        received: 'float',
      },
    ]);
  });

  it('should not verify a Group with a string id', () => {
    const group = groupBuilder().build();
    // @ts-expect-error - id should be an integer
    group.id = group.id.toString();

    const result = GroupSchema.safeParse(group);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Expected number, received string',
        path: ['id'],
        received: 'string',
      },
    ]);
  });

  it('should not verify an invalid Group', () => {
    const group = {
      invalid: 'group',
    };

    const result = GroupSchema.safeParse(group);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['id'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'date',
        message: 'Required',
        path: ['created_at'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'date',
        message: 'Required',
        path: ['updated_at'],
        received: 'undefined',
      },
    ]);
  });
});
