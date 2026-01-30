import { networkStatsBuilder } from '@/modules/staking/datasources/entities/__tests__/network-stats.entity.builder';
import type { NetworkStats } from '@/modules/staking/datasources/entities/network-stats.entity';
import { NetworkStatsSchema } from '@/modules/staking/datasources/entities/network-stats.entity';
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
      message: 'Invalid input: expected number, received string',
      path: [key],
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
      message: 'Invalid input: expected number, received string',
      path: [key],
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
      message: 'Invalid input: expected number, received string',
      path: [key],
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
        message: 'Invalid input: expected number, received undefined',
        path: ['eth_price_usd'],
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Invalid input: expected number, received undefined',
        path: ['nb_validators'],
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Invalid input: expected number, received undefined',
        path: ['network_gross_apy'],
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Invalid input: expected number, received undefined',
        path: ['supply_staked_percent'],
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Invalid input: expected number, received undefined',
        path: ['estimated_entry_time_seconds'],
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Invalid input: expected number, received undefined',
        path: ['estimated_exit_time_seconds'],
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Invalid input: expected number, received undefined',
        path: ['estimated_withdrawal_time_seconds'],
      },
      {
        code: 'invalid_type',
        expected: 'date',
        message: 'Invalid input: expected date, received Date',
        path: ['updated_at'],
        received: 'Invalid Date',
      },
    ]);
  });
});
