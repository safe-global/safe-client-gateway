import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { defiVaultStakeBuilder } from '@/datasources/staking-api/entities/__tests__/defi-vault-state.entity.builder';
import { DefiVaultStakeSchema } from '@/datasources/staking-api/entities/defi-vault-stake.entity';

describe('DefiVaultStakeSchema', () => {
  it('should validate a DefiVaultStake', () => {
    const defiVaultStake = defiVaultStakeBuilder().build();

    const result = DefiVaultStakeSchema.safeParse(defiVaultStake);

    expect(result.success).toBe(true);
  });

  it.each(['owner' as const, 'vault' as const])(
    'should checksum the %s address',
    (field) => {
      const lowerCaseAddress = faker.finance.ethereumAddress().toLowerCase();
      const defiVaultStake = defiVaultStakeBuilder()
        .with(field, lowerCaseAddress as `0x${string}`)
        .build();

      const result = DefiVaultStakeSchema.safeParse(defiVaultStake);

      expect(result.success && result.data[field]).toBe(
        getAddress(lowerCaseAddress),
      );
    },
  );

  it.each([
    'current_balance' as const,
    'shares_balance' as const,
    'total_rewards' as const,
    'current_rewards' as const,
    'total_deposited_amount' as const,
    'total_withdrawn_amount' as const,
  ])('should not allow a non-numerical string for %s', (field) => {
    const defiVaultStake = defiVaultStakeBuilder()
      .with(field, 'not-a-number')
      .build();

    const result = DefiVaultStakeSchema.safeParse(defiVaultStake);

    expect(!result.success && result.error.issues[0]).toStrictEqual({
      code: 'custom',
      message: 'Invalid base-10 numeric string',
      path: [field],
    });
  });

  it('should default to unknown for unknown chain values', () => {
    const defiVaultStake = defiVaultStakeBuilder()
      .with('chain', faker.string.alpha() as 'unknown')
      .build();

    const result = DefiVaultStakeSchema.safeParse(defiVaultStake);

    expect(result.success && result.data.chain).toBe('unknown');
  });

  it('should not validate a non-DefiVaultStake', () => {
    const defiVaultStake = {
      invalid: 'defiVaultStake',
    };

    const result = DefiVaultStakeSchema.safeParse(defiVaultStake);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['vault_id'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['owner'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['current_balance'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['shares_balance'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['total_rewards'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['current_rewards'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['total_deposited_amount'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['total_withdrawn_amount'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['vault'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['chain_id'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['updated_at_block'],
        received: 'undefined',
      },
    ]);
  });
});
