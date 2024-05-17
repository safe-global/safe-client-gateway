import { lockingRankBuilder } from '@/domain/community/entities/__tests__/locking-rank.builder';
import { LockingRankSchema } from '@/domain/community/entities/schemas/locking-rank.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('RankSchema', () => {
  it('should validate a valid locking rank', () => {
    const lockingRank = lockingRankBuilder().build();

    const result = LockingRankSchema.safeParse(lockingRank);

    expect(result.success).toBe(true);
  });

  it('should checksum the holder', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as `0x${string}`;
    const lockingRank = lockingRankBuilder()
      .with('holder', nonChecksummedAddress)
      .build();

    const result = LockingRankSchema.safeParse(lockingRank);

    expect(result.success && result.data.holder).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should not validate an invalid locking rank', () => {
    const lockingRank = { invalid: 'lockingRank' };

    const result = LockingRankSchema.safeParse(lockingRank);

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
          expected: 'number',
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
