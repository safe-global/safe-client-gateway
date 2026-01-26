import { transactionDataDtoBuilder } from '@/modules/data-decoder/routes/entities/__tests__/transaction-data.dto.builder';
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';
import { TransactionDataDtoSchema } from '@/routes/common/entities/transaction-data.dto.entity';

describe('TransactionDataDtoSchema', () => {
  it('should validate a valid TransactionDataDto', () => {
    const transactionDataDto = transactionDataDtoBuilder().build();

    const result = TransactionDataDtoSchema.safeParse(transactionDataDto);

    expect(result.success).toBe(true);
  });

  it('should checksum the to', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as Address;
    const transactionDataDto = transactionDataDtoBuilder()
      .with('to', nonChecksummedAddress)
      .build();

    const result = TransactionDataDtoSchema.safeParse(transactionDataDto);

    expect(result.success && result.data.to).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should allow optional to', () => {
    const transactionDataDto = transactionDataDtoBuilder().build();

    const result = TransactionDataDtoSchema.safeParse(transactionDataDto);

    expect(result.success).toBe(true);
  });

  it('should not allow non-hex data', () => {
    const transactionDataDto = transactionDataDtoBuilder()
      .with('data', 'non-hex' as Address)
      .build();

    const result = TransactionDataDtoSchema.safeParse(transactionDataDto);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid "0x" notated hex string',
        path: ['data'],
      },
    ]);
  });

  it('should not allow no hex', () => {
    const transactionDataDto = transactionDataDtoBuilder().build();
    // @ts-expect-error - inferred type does not allow optional propety
    delete transactionDataDto.data;

    const result = TransactionDataDtoSchema.safeParse(transactionDataDto);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['data'],
      },
    ]);
  });

  it('should not validate an invalid TransactionDataDto', () => {
    const transactionDataDto = { invalid: 'transactionDataDto' };

    const result = TransactionDataDtoSchema.safeParse(transactionDataDto);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['data'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['to'],
      },
    ]);
  });
});
