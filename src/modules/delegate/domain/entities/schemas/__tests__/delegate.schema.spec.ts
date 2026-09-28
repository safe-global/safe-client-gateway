// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';
import { delegateBuilder } from '@/modules/delegate/domain/entities/__tests__/delegate.builder';
import { DelegateSchema } from '@/modules/delegate/domain/entities/schemas/delegate.schema';

describe('DelegateSchema', () => {
  it('should validate a valid delegate', () => {
    const delegate = delegateBuilder().build();

    const result = DelegateSchema.safeParse(delegate);

    expect(result.success).toBe(true);
  });

  it('should default created and modified to null when absent', () => {
    const delegate = delegateBuilder().build();
    // @ts-expect-error - inferred type doesn't allow optional properties
    delete delegate.created;
    // @ts-expect-error - inferred type doesn't allow optional properties
    delete delegate.modified;

    const result = DelegateSchema.safeParse(delegate);

    expect(result.success && result.data.created).toBeNull();
    expect(result.success && result.data.modified).toBeNull();
  });

  it('should coerce created and modified when present', () => {
    const created = faker.date.past();
    const modified = faker.date.recent();
    const delegate = delegateBuilder()
      .with('created', created)
      .with('modified', modified)
      .build();

    const result = DelegateSchema.safeParse(delegate);

    expect(result.success && result.data.created).toStrictEqual(created);
    expect(result.success && result.data.modified).toStrictEqual(modified);
  });

  it('should allow optional safe, defaulting to null', () => {
    const delegate = delegateBuilder().build();
    // @ts-expect-error - inferred type doesn't allow optional properties
    delegate.safe = undefined;

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
