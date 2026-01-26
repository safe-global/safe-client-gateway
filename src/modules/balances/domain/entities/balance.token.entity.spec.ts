import { balanceTokenBuilder } from '@/modules/balances/domain/entities/__tests__/balance.token.builder';
import { BalanceTokenSchema } from '@/modules/balances/domain/entities/balance.token.entity';

describe('BalanceTokenSchema', () => {
  it('should validate a valid balance token', () => {
    const balanceToken = balanceTokenBuilder().build();

    const result = BalanceTokenSchema.safeParse(balanceToken);

    expect(result.success).toBe(true);
  });

  it('should not allow an invalid balance token', () => {
    const balanceToken = { invalid: 'balanceToken' };

    const result = BalanceTokenSchema.safeParse(balanceToken);

    expect(!result.success && result.error?.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['name'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['symbol'],
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Invalid input: expected number, received undefined',
        path: ['decimals'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['logoUri'],
      },
    ]);
  });
});
