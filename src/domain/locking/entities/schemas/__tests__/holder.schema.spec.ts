import { holderBuilder } from '@/domain/locking/entities/__tests__/holder.builder';
import { HolderSchema } from '@/domain/locking/entities/holder.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('HolderSchema', () => {
  it('should validate a valid holder', () => {
    const holder = holderBuilder().build();

    const result = HolderSchema.safeParse(holder);

    expect(result.success).toBe(true);
  });

  it('should checksum the holder address', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as `0x${string}`;
    const holder = holderBuilder()
      .with('holder', nonChecksummedAddress)
      .build();

    const result = HolderSchema.safeParse(holder);

    expect(result.success && result.data.holder).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should not validate an invalid holder', () => {
    const holder = { invalid: 'holder' };

    const result = HolderSchema.safeParse(holder);

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
          path: ['boost'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['points'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['boostedPoints'],
          message: 'Required',
        },
      ]),
    );
  });
});
