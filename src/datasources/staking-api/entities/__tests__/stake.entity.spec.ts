import { stakeBuilder } from '@/datasources/staking-api/entities/__tests__/stake.entity.builder';
import {
  StakeSchema,
  StakeState,
} from '@/datasources/staking-api/entities/stake.entity';
import { faker } from '@faker-js/faker';

describe('StakeSchema', () => {
  it('should validate a Stake object', () => {
    const stake = stakeBuilder().build();

    const result = StakeSchema.safeParse(stake);

    expect(result.success).toBe(true);
  });

  it('should fallback to unknown for an invalid state', () => {
    const stake = stakeBuilder()
      .with('state', 'invalid_state' as unknown as StakeState)
      .build();

    const result = StakeSchema.safeParse(stake);

    expect(result.success && result.data.state).toBe(StakeState.Unknown);
  });

  it('should not validate non-string validator_address values', () => {
    const stake = stakeBuilder().build();

    // @ts-expect-error - validator_address is expected to be a string
    stake.validator_address = faker.number.int();

    const result = StakeSchema.safeParse(stake);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(!result.success && result.error.issues[0]).toStrictEqual({
      code: 'invalid_type',
      expected: 'string',
      received: 'number',
      message: 'Expected string, received number',
      path: ['validator_address'],
    });
  });

  it('should not validate a `validator_address` with an invalid length', () => {
    const stake = stakeBuilder().with('validator_address', '0x00').build();

    const result = StakeSchema.safeParse(stake);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(!result.success && result.error.issues[0]).toStrictEqual({
      code: 'custom',
      message: 'Invalid input',
      path: ['validator_address'],
    });
  });

  it.each(['rewards' as const, 'net_claimable_consensus_rewards' as const])(
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
        path: ['rewards'],
        received: 'undefined',
      },
    ]);
  });
});
