import { dedicatedStakingStatsBuilder } from '@/modules/staking/datasources/entities/__tests__/dedicated-staking-stats.entity.builder';
import { DedicatedStakingStatsSchema } from '@/modules/staking/datasources/entities/dedicated-staking-stats.entity';
import { faker } from '@faker-js/faker';

describe('DedicatedStakingStatsSchema', () => {
  it('should validate a DedicatedStakingStats object', () => {
    const dedicatedStakingStats = dedicatedStakingStatsBuilder().build();

    const result = DedicatedStakingStatsSchema.safeParse(dedicatedStakingStats);

    expect(result.success).toBe(true);
  });

  it.each(['last_1d' as const, 'last_7d' as const, 'last_30d' as const])(
    'should not validate numeric string %s values',
    (key) => {
      const dedicatedStakingStats = dedicatedStakingStatsBuilder().build();
      dedicatedStakingStats.gross_apy[key] =
        faker.string.numeric() as unknown as number;

      const result = DedicatedStakingStatsSchema.safeParse(
        dedicatedStakingStats,
      );

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'number',
          message: 'Invalid input: expected number, received string',
          path: ['gross_apy', key],
        },
      ]);
    },
  );

  it('should coerce the updated_at field to a date', () => {
    const updatedAt = faker.date.recent().toISOString().slice(0, 10);
    const dedicatedStakingStats = dedicatedStakingStatsBuilder().build();
    // YYY-MM-DD
    dedicatedStakingStats.updated_at = updatedAt as unknown as Date;

    const result = DedicatedStakingStatsSchema.safeParse(dedicatedStakingStats);

    expect(result.success && result.data.updated_at).toStrictEqual(
      new Date(`${updatedAt}T00:00:00.000Z`),
    );
  });

  it.each(
    Object.keys(DedicatedStakingStatsSchema.shape) as Array<
      keyof typeof DedicatedStakingStatsSchema.shape
    >,
  )('should not validate missing %s field', (key) => {
    const dedicatedStakingStats = dedicatedStakingStatsBuilder().build();
    delete dedicatedStakingStats[key];

    const result = DedicatedStakingStatsSchema.safeParse(dedicatedStakingStats);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(!result.success && result.error.issues[0].path[0]).toBe(key);
  });

  it('should not validate an invalid DedicatedStakingStats object', () => {
    const dedicatedStakingStats = {
      invalid: 'dedicatedStakingStats',
    };

    const result = DedicatedStakingStatsSchema.safeParse(dedicatedStakingStats);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'object',
        message: 'Invalid input: expected object, received undefined',
        path: ['gross_apy'],
      },
      {
        code: 'invalid_type',
        message: 'Invalid input: expected date, received Date',
        path: ['updated_at'],
        expected: 'date',
        received: 'Invalid Date',
      },
    ]);
  });
});
