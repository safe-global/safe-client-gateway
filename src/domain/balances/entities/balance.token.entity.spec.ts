import { balanceTokenBuilder } from '@/domain/balances/entities/__tests__/balance.token.builder';
import { BalanceTokenSchema } from '@/domain/balances/entities/balance.token.entity';
import { ZodError } from 'zod';

describe('BalanceTokenSchema', () => {
  it('should validate a valid balance token', () => {
    const balanceToken = balanceTokenBuilder().build();

    const result = BalanceTokenSchema.safeParse(balanceToken);

    expect(result.success).toBe(true);
  });

  it('should not allow an invalid balance token', () => {
    const balanceToken = { invalid: 'balanceToken' };

    const result = BalanceTokenSchema.safeParse(balanceToken);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['name'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['symbol'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'number',
          received: 'undefined',
          path: ['decimals'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['logoUri'],
          message: 'Required',
        },
      ]),
    );
  });
});
