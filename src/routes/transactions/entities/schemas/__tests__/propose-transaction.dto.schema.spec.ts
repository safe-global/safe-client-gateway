import { Operation } from '@/domain/safe/entities/operation.entity';
import { proposeTransactionDtoBuilder } from '@/routes/transactions/entities/__tests__/propose-transaction.dto.builder';
import { ProposeTransactionDtoSchema } from '@/routes/transactions/entities/schemas/propose-transaction.dto.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('ProposeTransactionDtoSchema', () => {
  it('should validate a valid ProposeTransactionDto', () => {
    const proposeTransactionDto = proposeTransactionDtoBuilder().build();

    const result = ProposeTransactionDtoSchema.safeParse(proposeTransactionDto);

    expect(result.success).toBe(true);
  });

  ['to' as const, 'gasToken' as const, 'sender' as const].forEach((field) => {
    it(`should not allow non-address ${field}`, () => {
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with(field, faker.string.alphanumeric() as `0x${string}`)
        .build();

      const result = ProposeTransactionDtoSchema.safeParse(
        proposeTransactionDto,
      );

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'custom',
            path: [field],
            message: 'Invalid input',
          },
        ]),
      );
    });

    it(`should checksum ${field}`, () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase() as `0x${string}`;
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with(field, nonChecksummedAddress)
        .build();

      const result = ProposeTransactionDtoSchema.safeParse(
        proposeTransactionDto,
      );

      expect(result.success && result.data[field]).toBe(
        getAddress(nonChecksummedAddress),
      );
    });
  });

  [
    'value' as const,
    'nonce' as const,
    'safeTxGas' as const,
    'baseGas' as const,
    'gasPrice' as const,
  ].forEach((field) => {
    it(`should validate if ${field} is a numeric string`, () => {
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with(field, faker.string.numeric())
        .build();

      const result = ProposeTransactionDtoSchema.safeParse(
        proposeTransactionDto,
      );

      expect(result.success).toBe(true);
    });

    it(`should not allow non-numeric string ${field}`, () => {
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with(field, faker.string.alpha())
        .build();

      const result = ProposeTransactionDtoSchema.safeParse(
        proposeTransactionDto,
      );

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'custom',
            message: 'Invalid input',
            path: [field],
          },
        ]),
      );
    });
  });
  ['safeTxHash' as const, 'signature' as const].forEach((field) => {
    it(`should validate if ${field} is hex`, () => {
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with(field, faker.string.hexadecimal() as `0x${string}`)
        .build();

      const result = ProposeTransactionDtoSchema.safeParse(
        proposeTransactionDto,
      );

      expect(result.success).toBe(true);
    });

    it(`should not allow non-hex ${field}`, () => {
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with(field, faker.string.alphanumeric() as `0x${string}`)
        .build();

      const result = ProposeTransactionDtoSchema.safeParse(
        proposeTransactionDto,
      );

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'custom',
            message: 'Invalid input',
            path: [field],
          },
        ]),
      );
    });
  });

  it.each([
    'data' as const,
    'refundReceiver' as const,
    'signature' as const,
    'origin' as const,
  ])(`should allow optional %s, defaulting to null`, (field) => {
    const proposeTransactionDto = proposeTransactionDtoBuilder().build();
    delete proposeTransactionDto[field];

    const result = ProposeTransactionDtoSchema.safeParse(proposeTransactionDto);

    expect(result.success && result.data[field]).toBe(null);
  });

  it.each([0, 1])('should validate %s as operation', (operation) => {
    const proposeTransactionDto = proposeTransactionDtoBuilder()
      .with('operation', operation)
      .build();

    const result = ProposeTransactionDtoSchema.safeParse(proposeTransactionDto);

    expect(result.success && result.data.operation).toBe(operation);
  });

  it('should not allow invalid operation', () => {
    const proposeTransactionDto = proposeTransactionDtoBuilder()
      .with('operation', 2 as Operation)
      .build();

    const result = ProposeTransactionDtoSchema.safeParse(proposeTransactionDto);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          received: 2,
          code: 'invalid_enum_value',
          options: [0, 1],
          path: ['operation'],
          message: "Invalid enum value. Expected 0 | 1, received '2'",
        },
      ]),
    );
  });
});
