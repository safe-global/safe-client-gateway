import { faker } from '@faker-js/faker';
import type { Address } from 'viem';
import { getAddress } from 'viem';

import { defiMorphoExtraRewardBuilder } from '@/modules/staking/datasources/entities/__tests__/defi-morpho-extra-reward.entity.builder';
import { DefiMorphoExtraRewardSchema } from '@/modules/staking/datasources/entities/defi-morpho-extra-reward.entity';

describe('DefiMorphoExtraRewardSchema', () => {
  it('should validate a DefiMorphoExtraRewardSchema', () => {
    const defiMorphoExtraReward = defiMorphoExtraRewardBuilder().build();

    const result = DefiMorphoExtraRewardSchema.safeParse(defiMorphoExtraReward);

    expect(result.success).toBe(true);
  });

  it('should checksum the asset address', () => {
    const lowerCaseAddress = faker.finance.ethereumAddress().toLowerCase();
    const defiMorphoExtraReward = defiMorphoExtraRewardBuilder()
      .with('asset', lowerCaseAddress as Address)
      .build();

    const result = DefiMorphoExtraRewardSchema.safeParse(defiMorphoExtraReward);

    expect(result.success && result.data.asset).toBe(
      getAddress(lowerCaseAddress),
    );
  });

  it.each(['claimable' as const, 'claimable_next' as const])(
    'should not allow a non-numerical string for %s',
    (field) => {
      const defiMorphoExtraReward = defiMorphoExtraRewardBuilder()
        .with(field, 'not-a-number')
        .build();

      const result = DefiMorphoExtraRewardSchema.safeParse(
        defiMorphoExtraReward,
      );

      expect(!result.success && result.error.issues[0]).toStrictEqual({
        code: 'custom',
        message: 'Invalid base-10 numeric string',
        path: [field],
      });
    },
  );

  it('should not validate a non-DefiMorphoExtraRewardSchema', () => {
    const defiMorphoExtraReward = {
      invalid: 'defiMorphoExtraReward',
    };

    const result = DefiMorphoExtraRewardSchema.safeParse(defiMorphoExtraReward);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Invalid input: expected number, received undefined',
        path: ['chain_id'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['asset'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['claimable'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['claimable_next'],
      },
    ]);
  });
});
