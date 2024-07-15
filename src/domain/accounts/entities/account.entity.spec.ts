import { accountBuilder } from '@/domain/accounts/entities/__tests__/account.builder';
import { AccountSchema } from '@/domain/accounts/entities/account.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('AccountSchema', () => {
  it('should verify an Account', () => {
    const account = accountBuilder().build();

    const result = AccountSchema.safeParse(account);

    expect(result.success).toBe(true);
  });

  it.each(['id' as const, 'group_id' as const])(
    'should not verify an Account with a float %s',
    (field) => {
      const account = accountBuilder()
        .with(field, faker.number.float())
        .build();

      const result = AccountSchema.safeParse(account);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'integer',
          message: 'Expected integer, received float',
          path: [field],
          received: 'float',
        },
      ]);
    },
  );

  it.each(['id' as const, 'group_id' as const])(
    'should not verify an Account with a string %s',
    (field) => {
      const account = accountBuilder().build();
      // @ts-expect-error - should be integers
      account[field] = account[field].toString();

      const result = AccountSchema.safeParse(account);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'number',
          message: 'Expected number, received string',
          path: [field],
          received: 'string',
        },
      ]);
    },
  );

  it('should not verify an Account with a non-Ethereum address', () => {
    const account = accountBuilder().with('address', '0x123').build();

    const result = AccountSchema.safeParse(account);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid address',
        path: ['address'],
      },
    ]);
  });

  it('should checksum the address of an Account', () => {
    const account = accountBuilder().build();
    // @ts-expect-error - address should be `0x${string}`
    account.address = account.address.toLowerCase();

    const result = AccountSchema.safeParse(account);

    expect(result.success && result.data.address).toBe(
      getAddress(account.address),
    );
  });

  it('should not verify an invalid Account', () => {
    const account = {
      invalid: 'account',
    };

    const result = AccountSchema.safeParse(account);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['id'],
        received: 'undefined',
      },
      {
        code: 'invalid_date',
        message: 'Invalid date',
        path: ['created_at'],
      },
      {
        code: 'invalid_date',
        message: 'Invalid date',
        path: ['updated_at'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['address'],
        received: 'undefined',
      },
    ]);
  });
});
