import { creationTransactionBuilder } from '@/domain/safe/entities/__tests__/creation-transaction.builder';
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
    const creationTransaction = creationTransactionBuilder().build();

    const result = CreationTransactionSchema.safeParse(creationTransaction);

    expect(result.success && result.data.created).toBeInstanceOf(Date);
  });

  it.each([
    ['creator' as const],
    ['factoryAddress' as const],
    ['masterCopy' as const],
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
    ['masterCopy' as const],
    ['setupData' as const],
    ['dataDecoded' as const],
  ])('should allow an optional %s', (field) => {
    const creationTransaction = creationTransactionBuilder().build();
    delete creationTransaction[field];

    const result = CreationTransactionSchema.safeParse(creationTransaction);

    expect(result.success && result.data[field]).toBe(null);
  });

  it.each([
    ['created' as const],
    ['creator' as const],
    ['transactionHash' as const],
    ['factoryAddress' as const],
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
