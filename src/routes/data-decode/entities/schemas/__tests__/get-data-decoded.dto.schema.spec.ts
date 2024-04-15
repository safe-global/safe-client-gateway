import { transactionDataDtoBuilder } from '@/routes/data-decode/entities/__tests__/transaction-data.dto.builder';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';
import { TransactionDataDtoSchema } from '@/routes/common/entities/transaction-data.dto.entity';

describe('GetDataDecodedDtoSchema', () => {
  it('should validate a valid GetDataDecodedDto', () => {
    const getDataDecodedDto = transactionDataDtoBuilder().build();

    const result = TransactionDataDtoSchema.safeParse(getDataDecodedDto);

    expect(result.success).toBe(true);
  });

  it('should checksum the to', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as `0x${string}`;
    const getDataDecodedDto = transactionDataDtoBuilder()
      .with('to', nonChecksummedAddress)
      .build();

    const result = TransactionDataDtoSchema.safeParse(getDataDecodedDto);

    expect(result.success && result.data.to).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should allow optional to', () => {
    const getDataDecodedDto = transactionDataDtoBuilder().build();

    const result = TransactionDataDtoSchema.safeParse(getDataDecodedDto);

    expect(result.success).toBe(true);
  });

  it('should not allow non-hex data', () => {
    const getDataDecodedDto = transactionDataDtoBuilder()
      .with('data', 'non-hex' as `0x${string}`)
      .build();

    const result = TransactionDataDtoSchema.safeParse(getDataDecodedDto);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'custom',
          message: 'Invalid "0x" notated hex string',
          path: ['data'],
        },
      ]),
    );
  });

  it('should not allow no hex', () => {
    const getDataDecodedDto = transactionDataDtoBuilder().build();
    // @ts-expect-error - inferred type does not allow optional propety
    delete getDataDecodedDto.data;

    const result = TransactionDataDtoSchema.safeParse(getDataDecodedDto);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['data'],
          message: 'Required',
        },
      ]),
    );
  });

  it('should not validate an invalid GetDataDecodedDto', () => {
    const getDataDecodedDto = { invalid: 'getDataDecodedDto' };

    const result = TransactionDataDtoSchema.safeParse(getDataDecodedDto);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['data'],
          message: 'Required',
        },
      ]),
    );
  });
});
