import { stakeBuilder } from '@/datasources/staking-api/entities/__tests__/stake.entity.builder';
import { StakeSchema } from '@/datasources/staking-api/entities/stake.entity';
import { faker } from '@faker-js/faker';

describe('StakeSchema', () => {
  it('should validate a Stake object', () => {
    const stake = stakeBuilder().build();

    const result = StakeSchema.safeParse(stake);

    expect(result.success).toBe(true);
  });

  it.each(['validator_address' as const, 'state' as const])(
    'should not validate non-string %s values',
    (key) => {
      const stake = stakeBuilder().build();

      // @ts-expect-error - $key is expected to be a string
      stake[key] = faker.number.int();

      const result = StakeSchema.safeParse(stake);

      expect(!result.success && result.error.issues.length).toBe(1);
      expect(!result.success && result.error.issues[0]).toStrictEqual({
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        message: 'Expected string, received number',
        path: [key],
      });
    },
  );

  it.each(['effective_balance' as const, 'rewards' as const])(
    'should not validate non-numeric string %s values',
    (key) => {
      const stake = stakeBuilder().with(key, faker.lorem.word()).build();

      const result = StakeSchema.safeParse(stake);

      expect(!result.success && result.error.issues.length).toBe(1);
      expect(!result.success && result.error.issues[0]).toStrictEqual({
        code: 'custom',
        message: 'Invalid base-10 numeric string',
        path: [key],
      });
    },
  );

  it('should not validate an invalid Stake object', () => {
    const stake = { invalid: 'Stake' };

    const result = StakeSchema.safeParse(stake);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['validator_address'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['state'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['effective_balance'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['rewards'],
        received: 'undefined',
      },
    ]);
  });
});
