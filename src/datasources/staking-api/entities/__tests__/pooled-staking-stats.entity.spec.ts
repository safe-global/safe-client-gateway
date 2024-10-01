import { pooledStakingStatsBuilder } from '@/datasources/staking-api/entities/__tests__/pooled-staking-stats.entity.builder';
import type { PooledStakingStats } from '@/datasources/staking-api/entities/pooled-staking-stats.entity';
import { PooledStakingStatsSchema } from '@/datasources/staking-api/entities/pooled-staking-stats.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('PooledStakingSchema', () => {
  it('should validate a PooledStakingStats object', () => {
    const pooledStakingStats = pooledStakingStatsBuilder().build();

    const result = PooledStakingStatsSchema.safeParse(pooledStakingStats);

    expect(result.success).toBe(true);
  });

  it('should checksum the address', () => {
    const nonChecksummedAddress = faker.finance.ethereumAddress().toLowerCase();
    const pooledStakingStats = pooledStakingStatsBuilder()
      .with('address', nonChecksummedAddress as `0x${string}`)
      .build();

    const result = PooledStakingStatsSchema.safeParse(pooledStakingStats);

    expect(result.success && result.data.address).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it.each(['total_supply' as const, 'total_underlying_supply' as const])(
    'should not validate non-numeric string %s values',
    (key) => {
      const pooledStakingStats = pooledStakingStatsBuilder()
        .with(key, faker.string.alpha())
        .build();

      const result = PooledStakingStatsSchema.safeParse(pooledStakingStats);

      expect(!result.success && result.error.issues.length).toBe(1);
      expect(!result.success && result.error.issues[0]).toStrictEqual({
        code: 'custom',
        message: 'Invalid base-10 numeric string',
        path: [key],
      });
    },
  );

  it('should not validate non-numeric pools[number]total_deposited values', () => {
    const pooledStakingStats = pooledStakingStatsBuilder().build();
    pooledStakingStats.pools[0].total_deposited = faker.string.alpha();

    const result = PooledStakingStatsSchema.safeParse(pooledStakingStats);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(!result.success && result.error.issues[0]).toStrictEqual({
      code: 'custom',
      message: 'Invalid base-10 numeric string',
      path: ['pools', 0, 'total_deposited'],
    });
  });

  it.each([
    'address' as const,
    'factory_address' as const,
    'operator_address' as const,
  ])('should checksum the pools[number]%s', (key) => {
    const nonChecksummedAddress = faker.finance.ethereumAddress().toLowerCase();
    const pooledStakingStats = pooledStakingStatsBuilder().build();
    pooledStakingStats.pools[0][key] = nonChecksummedAddress as `0x${string}`;

    const result = PooledStakingStatsSchema.safeParse(pooledStakingStats);

    expect(result.success && result.data.pools[0][key]).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it.each([
    'fee' as const,
    'total_stakers' as const,
    'nrr' as const,
    'grr' as const,
  ])('should not validate numeric string %s values', (key) => {
    const pooledStakingStats = pooledStakingStatsBuilder()
      .with(key, faker.string.numeric() as unknown as number)
      .build();

    const result = PooledStakingStatsSchema.safeParse(pooledStakingStats);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(!result.success && result.error.issues[0]).toStrictEqual({
      code: 'invalid_type',
      expected: 'number',
      message: 'Expected number, received string',
      path: [key],
      received: 'string',
    });
  });

  it.each([
    'one_year' as const,
    'six_month' as const,
    'three_month' as const,
    'one_month' as const,
    'one_week' as const,
  ])("should not validate numeric string %s['nrr' | 'grr'] values", (key) => {
    const pooledStakingStats = pooledStakingStatsBuilder().build();
    pooledStakingStats[key].nrr = faker.string.numeric() as unknown as number;
    pooledStakingStats[key].grr = faker.string.numeric() as unknown as number;

    const result = PooledStakingStatsSchema.safeParse(pooledStakingStats);

    expect(!result.success && result.error.issues.length).toBe(2);
    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Expected number, received string',
        path: [key, 'nrr'],
        received: 'string',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Expected number, received string',
        path: [key, 'grr'],
        received: 'string',
      },
    ]);
  });

  it.each(['ratio' as const, 'commission' as const])(
    'should not validate numeric string pools[number]%s values',
    (key) => {
      const pooledStakingStats = pooledStakingStatsBuilder().build();
      pooledStakingStats.pools[0][key] =
        faker.string.numeric() as unknown as number;

      const result = PooledStakingStatsSchema.safeParse(pooledStakingStats);

      expect(!result.success && result.error.issues.length).toBe(1);
      expect(!result.success && result.error.issues[0]).toStrictEqual({
        code: 'invalid_type',
        expected: 'number',
        message: 'Expected number, received string',
        path: ['pools', 0, key],
        received: 'string',
      });
    },
  );

  it.each(
    Object.keys(PooledStakingStatsSchema.shape) as Array<
      keyof PooledStakingStats
    >,
  )('should validate missing %s values', (key) => {
    const pooledStakingStats = pooledStakingStatsBuilder().build();
    delete pooledStakingStats[key];

    const result = PooledStakingStatsSchema.safeParse(pooledStakingStats);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(!result.success && result.error.issues[0].path[0]).toBe(key);
  });

  it('should not validate an invalid PooledStakingStats object', () => {
    const pooledStaking = {
      invalid: 'PooledStakingStats',
    };

    const result = PooledStakingStatsSchema.safeParse(pooledStaking);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['address'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['name'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['symbol'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['fee'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['total_supply'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['total_underlying_supply'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['total_stakers'],
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
        expected: 'number',
        message: 'Required',
        path: ['grr'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'object',
        message: 'Required',
        path: ['one_year'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'object',
        message: 'Required',
        path: ['six_month'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'object',
        message: 'Required',
        path: ['three_month'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'object',
        message: 'Required',
        path: ['one_month'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'object',
        message: 'Required',
        path: ['one_week'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'array',
        message: 'Required',
        path: ['pools'],
        received: 'undefined',
      },
    ]);
  });
});
