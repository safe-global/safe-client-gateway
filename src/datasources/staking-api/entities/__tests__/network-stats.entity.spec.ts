import { networkStatsBuilder } from '@/datasources/staking-api/entities/__tests__/network-stats.entity.builder';
import type { NetworkStats } from '@/datasources/staking-api/entities/network-stats.entity';
import { NetworkStatsSchema } from '@/datasources/staking-api/entities/network-stats.entity';
import { faker } from '@faker-js/faker';

describe('NetworkStatsSchema', () => {
  it('should validate a NetworkStats object', () => {
    const networkStats = networkStatsBuilder().build();

    const result = NetworkStatsSchema.safeParse(networkStats);

    expect(result.success).toBe(true);
  });

  it.each([
    'eth_price_usd' as const,
    'network_gross_apy' as const,
    'supply_staked_percent' as const,
  ])('should not validate numeric string %s values', (key) => {
    const networkStats = networkStatsBuilder()
      .with(key, faker.string.numeric() as unknown as number)
      .build();

    const result = NetworkStatsSchema.safeParse(networkStats);

    expect(!result.success && result.error.issues[0]).toStrictEqual({
      code: 'invalid_type',
      expected: 'number',
      message: 'Expected number, received string',
      path: [key],
      received: 'string',
    });
  });

  it.each([
    'nb_validators' as const,
    'estimated_entry_time_seconds' as const,
    'estimated_exit_time_seconds' as const,
    'estimated_withdrawal_time_seconds' as const,
  ])('should not validate numeric string %s values', (key) => {
    const networkStats = networkStatsBuilder()
      .with(key, faker.string.numeric() as unknown as number)
      .build();

    const result = NetworkStatsSchema.safeParse(networkStats);

    expect(!result.success && result.error.issues[0]).toStrictEqual({
      code: 'invalid_type',
      expected: 'number',
      message: 'Expected number, received string',
      path: [key],
      received: 'string',
    });
  });

  it.each([
    'nb_validators' as const,
    'estimated_entry_time_seconds' as const,
    'estimated_exit_time_seconds' as const,
    'estimated_withdrawal_time_seconds' as const,
  ])('should not validate numeric string %s values', (key) => {
    const networkStats = networkStatsBuilder()
      .with(key, faker.string.numeric() as unknown as number)
      .build();

    const result = NetworkStatsSchema.safeParse(networkStats);

    expect(!result.success && result.error.issues[0]).toStrictEqual({
      code: 'invalid_type',
      expected: 'number',
      message: 'Expected number, received string',
      path: [key],
      received: 'string',
    });
  });

  it('should coerce updated_at to a date', () => {
    const updatedAt = faker.date.recent();
    const networkStats = networkStatsBuilder()
      .with('updated_at', updatedAt.toISOString() as unknown as Date)
      .build();

    const result = NetworkStatsSchema.safeParse(networkStats);

    expect(result.success && result.data.updated_at).toStrictEqual(updatedAt);
  });

  it.each(Object.keys(NetworkStatsSchema.shape) as Array<keyof NetworkStats>)(
    'should not validate missing %s values',
    (key) => {
      const networkStats = networkStatsBuilder().build();
      delete networkStats[key];

      const result = NetworkStatsSchema.safeParse(networkStats);

      expect(!result.success && result.error.issues[0].path[0]).toBe(key);
    },
  );

  it('should not validate an invalid NetworkStats object', () => {
    const networkStats = {
      invalid: 'networkStats',
    };

    const result = NetworkStatsSchema.safeParse(networkStats);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['eth_price_usd'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['nb_validators'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['network_gross_apy'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['supply_staked_percent'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['estimated_entry_time_seconds'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['estimated_exit_time_seconds'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['estimated_withdrawal_time_seconds'],
        received: 'undefined',
      },
      { code: 'invalid_date', message: 'Invalid date', path: ['updated_at'] },
    ]);
  });
});
