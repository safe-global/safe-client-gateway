import { creationTransactionBuilder } from '@/domain/safe/entities/__tests__/creation-transaction.builder';
import { CreationTransaction } from '@/domain/safe/entities/creation-transaction.entity';
import { CreationTransactionSchema } from '@/domain/safe/entities/schemas/creation-transaction.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('CreationTransactionSchema', () => {
  it('should validate a valid creation transaction', () => {
    const creationTransaction = creationTransactionBuilder().build();

    const result = CreationTransactionSchema.safeParse(creationTransaction);

    expect(result.success).toBe(true);
  });

  it('should coerce the created date to a Date', () => {
    const creationTransaction = creationTransactionBuilder()
      .with('created', faker.date.recent().toISOString() as unknown as Date)
      .build();

    const result = CreationTransactionSchema.safeParse(creationTransaction);

    expect(result.success && result.data.created).toStrictEqual(
      new Date(creationTransaction.created),
    );
  });

  it.each<keyof CreationTransaction>([
    'creator' as const,
    'factoryAddress' as const,
    'masterCopy' as const,
  ])('should checksum the %s', (field) => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as `0x${string}`;
    const creationTransaction = creationTransactionBuilder()
      .with(field, nonChecksummedAddress)
      .build();

    const result = CreationTransactionSchema.safeParse(creationTransaction);

    expect(result.success && result.data[field]).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it.each([
    'masterCopy' as const,
    'setupData' as const,
    'dataDecoded' as const,
  ])('should allow an optional %s', (field) => {
    const creationTransaction = creationTransactionBuilder().build();
    delete creationTransaction[field];

    const result = CreationTransactionSchema.safeParse(creationTransaction);

    expect(result.success && result.data[field]).toBe(null);
  });

  it.each([
    'creator' as const,
    'factoryAddress' as const,
    'masterCopy' as const,
  ])('should not allow non-address %s', (field) => {
    const creationTransaction = creationTransactionBuilder()
      .with(field, 'not an address' as `0x${string}`)
      .build();

    const result = CreationTransactionSchema.safeParse(creationTransaction);

    expect(!result.success && result.error.issues).toEqual([
      {
        code: 'custom',
        message: 'Invalid address',
        path: [field],
      },
    ]);
  });

  it.each(['transactionHash' as const, 'setupData' as const])(
    'should not allow non-hex %s',
    (field) => {
      const creationTransaction = creationTransactionBuilder()
        .with(field, 'not a hex string' as `0x${string}`)
        .build();

      const result = CreationTransactionSchema.safeParse(creationTransaction);

      expect(!result.success && result.error.issues).toEqual([
        {
          code: 'custom',
          message: 'Invalid hex string',
          path: [field],
        },
      ]);
    },
  );

  it.each([
    'created' as const,
    'creator' as const,
    'transactionHash' as const,
    'factoryAddress' as const,
  ])('should not allow an undefined %s', (field) => {
    const creationTransaction = creationTransactionBuilder().build();
    delete creationTransaction[field];

    const result = CreationTransactionSchema.safeParse(creationTransaction);

    expect(
      !result.success &&
        result.error.issues.length === 1 &&
        result.error.issues[0].path.length === 1 &&
        result.error.issues[0].path[0] === field,
    ).toBe(true);
  });
});
