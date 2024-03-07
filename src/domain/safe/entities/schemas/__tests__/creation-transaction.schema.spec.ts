import { creationTransactionBuilder } from '@/domain/safe/entities/__tests__/creation-transaction.builder';
import { CreationTransactionSchema } from '@/domain/safe/entities/schemas/creation-transaction.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('CreationTransactionSchema', () => {
  it('should validate a valid creation transaction', () => {
    const creationTransaction = creationTransactionBuilder().build();

    const result = CreationTransactionSchema.safeParse(creationTransaction);

    expect(result.success).toBe(true);
  });

  it('should checmsum the creator, factoryAddress and masterCopy', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as `0x${string}`;
    const creationTransaction = creationTransactionBuilder()
      .with('creator', nonChecksummedAddress)
      .with('factoryAddress', nonChecksummedAddress)
      .with('masterCopy', nonChecksummedAddress)
      .build();

    const result = CreationTransactionSchema.safeParse(creationTransaction);

    expect(result.success && result.data.creator).toBe(
      getAddress(nonChecksummedAddress),
    );
    expect(result.success && result.data.factoryAddress).toBe(
      getAddress(nonChecksummedAddress),
    );
    expect(result.success && result.data.masterCopy).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should allow optional masterCopy, setupData and dataDecoded, defaulting to null', () => {
    const fields = ['masterCopy', 'setupData', 'dataDecoded'] as const;
    const creationTransaction = creationTransactionBuilder().build();
    fields.forEach((field) => {
      delete creationTransaction[field];
    });

    const result = CreationTransactionSchema.safeParse(creationTransaction);

    fields.forEach((field) => {
      expect(result.success && result.data[field]).toBe(null);
    });
  });

  it('should not validate an invalid creation creation transaction', () => {
    const creationTransaction = { invalid: 'creationTransaction' };

    const result = CreationTransactionSchema.safeParse(creationTransaction);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_date',
          path: ['created'],
          message: 'Invalid date',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['creator'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['transactionHash'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['factoryAddress'],
          message: 'Required',
        },
      ]),
    );
  });
});
