import { rankBuilder } from '@/domain/locking/entities/__tests__/rank.builder';
import { RankSchema } from '@/domain/locking/entities/schemas/rank.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('RankSchema', () => {
  it('should validate a valid rank', () => {
    const rank = rankBuilder().build();

    const result = RankSchema.safeParse(rank);

    expect(result.success).toBe(true);
  });

  it('should checksum the holder', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as `0x${string}`;
    const rank = rankBuilder().with('holder', nonChecksummedAddress).build();

    const result = RankSchema.safeParse(rank);

    expect(result.success && result.data.holder).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should not validate an invalid rank', () => {
    const rank = { invalid: 'rank' };

    const result = RankSchema.safeParse(rank);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['holder'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['position'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['lockedAmount'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['unlockedAmount'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['withdrawnAmount'],
          message: 'Required',
        },
      ]),
    );
  });
});
