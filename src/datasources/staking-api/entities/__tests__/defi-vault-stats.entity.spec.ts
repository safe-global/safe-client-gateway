import {
  defiVaultAdditionalRewardBuilder,
  defiVaultStatsBuilder,
} from '@/datasources/staking-api/entities/__tests__/defi-vault-stats.entity.builder';
import {
  DefiVaultStatsAdditionalRewardSchema,
  DefiVaultStatsSchema,
} from '@/datasources/staking-api/entities/defi-vault-stats.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('DefiVaultStatsSchema', () => {
  it('should validate a valid DefiVaultStats object', () => {
    const defiVaultStats = defiVaultStatsBuilder().build();

    const result = DefiVaultStatsSchema.safeParse(defiVaultStats);

    expect(result.success).toBe(true);
  });

  it.each(['asset' as const, 'vault' as const])(
    'should checksum an %s address',
    (key) => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const defiVaultStats = defiVaultStatsBuilder()
        .with(key, nonChecksummedAddress as `0x${string}`)
        .build();

      const result = DefiVaultStatsSchema.safeParse(defiVaultStats);

      expect(result.success && result.data[key]).toBe(
        getAddress(nonChecksummedAddress),
      );
    },
  );

  it.each(['asset_icon' as const, 'protocol_icon' as const])(
    'should not allow a non-URL %s',
    (key) => {
      const defiVaultStats = defiVaultStatsBuilder()
        .with(key, faker.string.numeric())
        .build();

      const result = DefiVaultStatsSchema.safeParse(defiVaultStats);

      expect(!result.success && result.error.issues.length).toBe(1);
      expect(!result.success && result.error.issues[0]).toStrictEqual({
        code: 'invalid_string',
        message: 'Invalid url',
        path: [key],
        validation: 'url',
      });
    },
  );

  it.each([
    'tvl' as const,
    'protocol_tvl' as const,
    'protocol_tvl' as const,
    'protocol_supply_limit' as const,
  ])('should not allow a non-numeric string %s values', (key) => {
    const defiVaultStats = defiVaultStatsBuilder()
      .with(key, faker.string.alpha())
      .build();

    const result = DefiVaultStatsSchema.safeParse(defiVaultStats);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(!result.success && result.error.issues[0]).toStrictEqual({
      code: 'custom',
      message: 'Invalid base-10 numeric string',
      path: [key],
    });
  });

  it.each(['protocol' as const, 'chain' as const])(
    'should default to unknown for unknown %s values',
    (key) => {
      const defiVaultStats = defiVaultStatsBuilder()
        .with(key, faker.string.alpha() as 'unknown')
        .build();

      const result = DefiVaultStatsSchema.safeParse(defiVaultStats);

      expect(result.success && result.data[key]).toBe('unknown');
    },
  );

  it.each([
    'asset' as const,
    'asset_icon' as const,
    'asset_symbol' as const,
    'share_symbol' as const,
    'tvl' as const,
    'protocol_icon' as const,
    'protocol_tvl' as const,
    'protocol_supply_limit' as const,
    'grr' as const,
    'nrr' as const,
    'vault' as const,
    'chain_id' as const,
    'asset_decimals' as const,
    'updated_at_block' as const,
  ])('should not allow missing %s values', (key) => {
    const defiVaultStats = defiVaultStatsBuilder().build();
    delete defiVaultStats[key];

    const result = DefiVaultStatsSchema.safeParse(defiVaultStats);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(!result.success && result.error.issues[0].path[0]).toBe(key);
  });

  it('should not validate an invalid DefiVaultStats object', () => {
    const defiVaultStats = {
      invalid: 'defiVaultStats',
    };

    const result = DefiVaultStatsSchema.safeParse(defiVaultStats);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['asset'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['asset_icon'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['asset_symbol'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['share_symbol'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['tvl'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['protocol_icon'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['protocol_tvl'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['protocol_supply_limit'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['grr'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['nrr'],
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
        path: ['asset_decimals'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['updated_at_block'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['performance_fee'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['additional_rewards_nrr'],
        received: 'undefined',
      },
    ]);
  });

  it('should not validate an invalid DefiVaultStatsAdditionalRewardSchema object', () => {
    const defiVaultStatsAdditionalReward = {
      invalid: 'defiVaultStatsAdditionalRewards',
    };

    const result = DefiVaultStatsAdditionalRewardSchema.safeParse(
      defiVaultStatsAdditionalReward,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['asset'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['nrr'],
        received: 'undefined',
      },
    ]);
  });

  it.each(['asset' as const, 'nrr' as const])(
    'should not allow missing %s values',
    (key) => {
      const defiVaultStatsAdditionalReward =
        defiVaultAdditionalRewardBuilder().build();
      delete defiVaultStatsAdditionalReward[key];

      const result = DefiVaultStatsAdditionalRewardSchema.safeParse(
        defiVaultStatsAdditionalReward,
      );

      expect(!result.success && result.error.issues.length).toBe(1);
      expect(!result.success && result.error.issues[0].path[0]).toBe(key);
    },
  );

  it('should checksum an asset address', () => {
    const nonChecksummedAddress = faker.finance.ethereumAddress().toLowerCase();
    const defiVaultStatsAdditionalReward = defiVaultAdditionalRewardBuilder()
      .with('asset', nonChecksummedAddress as `0x${string}`)
      .build();

    const result = DefiVaultStatsAdditionalRewardSchema.safeParse(
      defiVaultStatsAdditionalReward,
    );

    expect(result.success && result.data['asset']).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should not allow non numeric nrr values', () => {
    const defiVaultStatsAdditionalReward = defiVaultAdditionalRewardBuilder()
      // @ts-expect-error nrr is expected to be a number
      .with('nrr', faker.string.numeric())
      .build();

    const result = DefiVaultStatsAdditionalRewardSchema.safeParse(
      defiVaultStatsAdditionalReward,
    );

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(!result.success && result.error.issues[0]).toStrictEqual({
      code: 'invalid_type',
      expected: 'number',
      message: 'Expected number, received string',
      path: ['nrr'],
      received: 'string',
    });
  });
});
