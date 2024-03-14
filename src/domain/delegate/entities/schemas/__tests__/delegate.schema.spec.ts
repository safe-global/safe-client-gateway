import { delegateBuilder } from '@/domain/delegate/entities/__tests__/delegate.builder';
import { DelegateSchema } from '@/domain/delegate/entities/schemas/delegate.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('DelegateSchema', () => {
  it('should validate a valid delegate', () => {
    const delegate = delegateBuilder().build();

    const result = DelegateSchema.safeParse(delegate);

    expect(result.success).toBe(true);
  });

  it('should allow optional safe, defaulting to null', () => {
    const delegate = delegateBuilder().build();
    // @ts-expect-error - inferred type doesn't allow optional properties
    delete delegate.safe;

    const result = DelegateSchema.safeParse(delegate);

    expect(result.success && result.data.safe).toBe(null);
  });

  it('should checksum safe, delegate and delegator', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as `0x${string}`;
    const delegate = delegateBuilder()
      .with('safe', nonChecksummedAddress)
      .with('delegate', nonChecksummedAddress)
      .with('delegator', nonChecksummedAddress)
      .build();

    const result = DelegateSchema.safeParse(delegate);

    expect(result.success && result.data.safe).toBe(
      getAddress(nonChecksummedAddress),
    );
    expect(result.success && result.data.delegate).toBe(
      getAddress(nonChecksummedAddress),
    );
    expect(result.success && result.data.delegator).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should not allow invalid delegates', () => {
    const delegate = { invalid: 'delegate' };

    const result = DelegateSchema.safeParse(delegate);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['delegate'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['delegator'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['label'],
          message: 'Required',
        },
      ]),
    );
  });
});
