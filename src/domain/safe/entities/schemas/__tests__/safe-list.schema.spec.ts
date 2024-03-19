import { SafeListSchema } from '@/domain/safe/entities/schemas/safe-list.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('SafeListSchema', () => {
  it('should validate a SafeList', () => {
    const safeList = {
      safes: [faker.finance.ethereumAddress(), faker.finance.ethereumAddress()],
    };

    const result = SafeListSchema.safeParse(safeList);

    expect(result.success).toBe(true);
  });

  it('should checksum the Safes', () => {
    const nonChecksummedAddress1 = faker.finance
      .ethereumAddress()
      .toLowerCase();
    const nonChecksummedAddress2 = faker.finance
      .ethereumAddress()
      .toLowerCase();
    const safeList = {
      safes: [nonChecksummedAddress1, nonChecksummedAddress2],
    };

    const result = SafeListSchema.safeParse(safeList);

    expect(result.success && result.data.safes).toStrictEqual([
      getAddress(nonChecksummedAddress1),
      getAddress(nonChecksummedAddress2),
    ]);
  });

  it('should allow an empty list of Safes', () => {
    const safeList = {
      safes: [],
    };

    const result = SafeListSchema.safeParse(safeList);

    expect(result.success).toBe(true);
  });

  it('should not allow safes to be undefined', () => {
    const safeList = {};

    const result = SafeListSchema.safeParse(safeList);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'array',
          received: 'undefined',
          path: ['safes'],
          message: 'Required',
        },
      ]),
    );
  });
});
