import { delegateBuilder } from '@/modules/delegate/domain/entities/__tests__/delegate.builder';
import { DelegateSchema } from '@/modules/delegate/domain/entities/schemas/delegate.schema';
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';

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
      .toLowerCase() as Address;
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

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['delegate'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['delegator'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['label'],
      },
    ]);
  });
});
