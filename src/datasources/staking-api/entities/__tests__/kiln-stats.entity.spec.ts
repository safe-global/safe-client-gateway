import { kilnStatsBuilder } from '@/datasources/staking-api/entities/__tests__/kiln-stats.entity.builder';
import { KilnStatsSchema } from '@/datasources/staking-api/entities/kiln-stats.entity';
import { faker } from '@faker-js/faker';

describe('KilnStatsSchema', () => {
  it('should validate a KilnStats object', () => {
    const kilnStats = kilnStatsBuilder().build();

    const result = KilnStatsSchema.safeParse(kilnStats);

    expect(result.success).toBe(true);
  });

  it.each(['last_1d' as const, 'last_7d' as const, 'last_30d' as const])(
    'should not validate numeric string %s values',
    (key) => {
      const kilnStats = kilnStatsBuilder().build();
      kilnStats.gross_apy[key] = faker.string.numeric() as unknown as number;

      const result = KilnStatsSchema.safeParse(kilnStats);

      expect(!result.success && result.error.issues.length).toBe(1);
      expect(!result.success && result.error.issues[0]).toStrictEqual({
        code: 'invalid_type',
        expected: 'number',
        message: 'Expected number, received string',
        path: ['gross_apy', key],
        received: 'string',
      });
    },
  );

  it('should coerce the updated_at field to a date', () => {
    const updatedAt = faker.date.recent().toISOString().slice(0, 10);
    const kilnStats = kilnStatsBuilder().build();
    // YYY-MM-DD
    kilnStats.updated_at = updatedAt as unknown as Date;

    const result = KilnStatsSchema.safeParse(kilnStats);

    expect(result.success && result.data.updated_at).toStrictEqual(
      new Date(`${updatedAt}T00:00:00.000Z`),
    );
  });

  it.each(
    Object.keys(KilnStatsSchema.shape) as Array<
      keyof typeof KilnStatsSchema.shape
    >,
  )('should not validate missing %s field', (key) => {
    const kilnStats = kilnStatsBuilder().build();
    delete kilnStats[key];

    const result = KilnStatsSchema.safeParse(kilnStats);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(!result.success && result.error.issues[0].path[0]).toBe(key);
  });

  it('should not validate an invalid KilnStats object', () => {
    const kilnStats = {
      invalid: 'kilnStats',
    };

    const result = KilnStatsSchema.safeParse(kilnStats);

    expect(!result.success && result.error.issues.length).toBe(2);
    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'object',
        message: 'Required',
        path: ['gross_apy'],
        received: 'undefined',
      },
      {
        code: 'invalid_date',
        message: 'Invalid date',
        path: ['updated_at'],
      },
    ]);
  });
});
