import type { Operation } from '@/modules/safe/domain/entities/operation.entity';
import { proposeTransactionDtoBuilder } from '@/modules/transactions/routes/entities/__tests__/propose-transaction.dto.builder';
import { ProposeTransactionDtoSchema } from '@/modules/transactions/routes/entities/schemas/propose-transaction.dto.schema';
import { faker } from '@faker-js/faker';
import { type Address, getAddress, type Hash, type Hex } from 'viem';
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
        .with(field, faker.string.alphanumeric() as Address)
        .build();

      const result = ProposeTransactionDtoSchema.safeParse(
        proposeTransactionDto,
      );

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'custom',
            message: 'Invalid address',
            path: [field],
          },
        ]),
      );
    });

    it(`should checksum ${field}`, () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase() as Address;
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
            message: 'Invalid base-10 numeric string',
            path: [field],
          },
        ]),
      );
    });
  });

  it('should validate if safeTxHash is hex', () => {
    const proposeTransactionDto = proposeTransactionDtoBuilder()
      .with('safeTxHash', faker.string.hexadecimal() as Hash)
      .build();

    const result = ProposeTransactionDtoSchema.safeParse(proposeTransactionDto);

    expect(result.success).toBe(true);
  });

  it('should not allow non-hex safeTxHash', () => {
    const proposeTransactionDto = proposeTransactionDtoBuilder()
      .with('safeTxHash', faker.string.alphanumeric() as Hash)
      .build();

    const result = ProposeTransactionDtoSchema.safeParse(proposeTransactionDto);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'custom',
          message: 'Invalid "0x" notated hex string',
          path: ['safeTxHash'],
        },
      ]),
    );
  });

  it('should validate if signature is hex', () => {
    const proposeTransactionDto = proposeTransactionDtoBuilder()
      .with('signature', faker.string.hexadecimal({ length: 130 }) as Hex)
      .build();

    const result = ProposeTransactionDtoSchema.safeParse(proposeTransactionDto);

    expect(result.success).toBe(true);
  });

  it('should not allow non-hex signature', () => {
    const proposeTransactionDto = proposeTransactionDtoBuilder()
      .with('signature', faker.string.alphanumeric() as Address)
      .build();

    const result = ProposeTransactionDtoSchema.safeParse(proposeTransactionDto);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'custom',
          message: 'Invalid "0x" notated hex string',
          path: ['signature'],
        },
        {
          code: 'custom',
          message: 'Invalid hex bytes',
          path: ['signature'],
        },
        {
          code: 'custom',
          message: 'Invalid signature',
          path: ['signature'],
        },
      ]),
    );
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
