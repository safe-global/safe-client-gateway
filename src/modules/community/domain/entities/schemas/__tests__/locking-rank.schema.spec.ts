import { lockingRankBuilder } from '@/modules/community/domain/entities/__tests__/locking-rank.builder';
import { LockingRankSchema } from '@/modules/community/domain/entities/schemas/locking-rank.schema';
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';

describe('RankSchema', () => {
  it('should validate a valid locking rank', () => {
    const lockingRank = lockingRankBuilder().build();

    const result = LockingRankSchema.safeParse(lockingRank);

    expect(result.success).toBe(true);
  });

  it('should checksum the holder', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as Address;
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

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        path: ['holder'],
        message: 'Invalid input: expected string, received undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        path: ['position'],
        message: 'Invalid input: expected number, received undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        path: ['lockedAmount'],
        message: 'Invalid input: expected string, received undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        path: ['unlockedAmount'],
        message: 'Invalid input: expected string, received undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        path: ['withdrawnAmount'],
        message: 'Invalid input: expected string, received undefined',
      },
    ]);
  });
});
