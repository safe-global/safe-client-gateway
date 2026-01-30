import { faker } from '@faker-js/faker';
import type { Address } from 'viem';
import { getAddress } from 'viem';
import { defiVaultStakeBuilder } from '@/modules/staking/datasources/entities/__tests__/defi-vault-state.entity.builder';
import { DefiVaultStakeSchema } from '@/modules/staking/datasources/entities/defi-vault-stake.entity';

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
        .with(field, lowerCaseAddress as Address)
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
        message: 'Invalid input: expected string, received undefined',
        path: ['vault_id'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['owner'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['current_balance'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['shares_balance'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['total_rewards'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['current_rewards'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['total_deposited_amount'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['total_withdrawn_amount'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['vault'],
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Invalid input: expected number, received undefined',
        path: ['chain_id'],
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Invalid input: expected number, received undefined',
        path: ['updated_at_block'],
      },
    ]);
  });
});
