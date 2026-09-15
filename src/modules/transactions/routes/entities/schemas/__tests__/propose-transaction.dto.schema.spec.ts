// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Address, getAddress, type Hash, type Hex } from 'viem';
import type { Operation } from '@/modules/safe/domain/entities/operation.entity';
import {
  nestedTransactionDtoBuilder,
  proposeTransactionDtoBuilder,
} from '@/modules/transactions/routes/entities/__tests__/propose-transaction.dto.builder';
import type { NestedTransactionDto } from '@/modules/transactions/routes/entities/propose-transaction.dto.entity';
import { ProposeTransactionDtoSchema } from '@/modules/transactions/routes/entities/schemas/propose-transaction.dto.schema';

describe('ProposeTransactionDtoSchema', () => {
  it('should validate a valid ProposeTransactionDto', () => {
    const proposeTransactionDto = proposeTransactionDtoBuilder().build();

    const result = ProposeTransactionDtoSchema.safeParse(proposeTransactionDto);

    expect(result.success).toBe(true);
  });

  for (const field of ['to' as const, 'gasToken' as const, 'sender' as const]) {
    it(`should not allow non-address ${field}`, () => {
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with(field, faker.string.alphanumeric() as Address)
        .build();

      const result = ProposeTransactionDtoSchema.safeParse(
        proposeTransactionDto,
      );

      expect(!result.success && result.error.issues).toEqual([
        expect.objectContaining({
          code: 'custom',
          message: 'Invalid address',
          path: [field],
        }),
      ]);
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
  }

  for (const field of [
    'value' as const,
    'nonce' as const,
    'safeTxGas' as const,
    'baseGas' as const,
    'gasPrice' as const,
  ]) {
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

      expect(!result.success && result.error.issues).toEqual([
        expect.objectContaining({
          code: 'custom',
          message: 'Invalid base-10 numeric string',
          path: [field],
        }),
      ]);
    });
  }

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

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'custom',
        message: 'Invalid "0x" notated hex string',
        path: ['safeTxHash'],
      }),
    ]);
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

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'custom',
        message: 'Invalid "0x" notated hex string',
        path: ['signature'],
      }),
      expect.objectContaining({
        code: 'custom',
        message: 'Invalid hex bytes',
        path: ['signature'],
      }),
      expect.objectContaining({
        code: 'custom',
        message: 'Invalid signature',
        path: ['signature'],
      }),
    ]);
  });

  it.each([
    'data' as const,
    'refundReceiver' as const,
    'signature' as const,
    'origin' as const,
    'nestedTransaction' as const,
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

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid_value',
        values: [0, 1],
        path: ['operation'],
        message: 'Invalid option: expected one of 0|1',
      }),
    ]);
  });

  describe('origin', () => {
    it('should accept an origin within the size bound', () => {
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with('origin', 'a'.repeat(2048))
        .build();

      const result = ProposeTransactionDtoSchema.safeParse(
        proposeTransactionDto,
      );

      expect(result.success).toBe(true);
    });

    it('should reject an origin exceeding 2048 chars', () => {
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with('origin', 'a'.repeat(2049))
        .build();

      const result = ProposeTransactionDtoSchema.safeParse(
        proposeTransactionDto,
      );

      expect(!result.success && result.error.issues).toEqual([
        expect.objectContaining({
          code: 'too_big',
          maximum: 2048,
          path: ['origin'],
        }),
      ]);
    });
  });

  describe('nestedTransaction', () => {
    it('should validate a valid nested transaction', () => {
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with('nestedTransaction', nestedTransactionDtoBuilder().build())
        .build();

      const result = ProposeTransactionDtoSchema.safeParse(
        proposeTransactionDto,
      );

      expect(result.success).toBe(true);
    });

    it.each([
      'to' as const,
      'data' as const,
      'gasToken' as const,
      'refundReceiver' as const,
      'notes' as const,
    ])('should allow optional %s, defaulting to null', (field) => {
      const nestedTransaction = nestedTransactionDtoBuilder().build();
      delete nestedTransaction[field];
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with('nestedTransaction', nestedTransaction)
        .build();

      const result = ProposeTransactionDtoSchema.safeParse(
        proposeTransactionDto,
      );

      expect(result.success && result.data.nestedTransaction?.[field]).toBe(
        null,
      );
    });

    it.each([
      'value' as const,
      'operation' as const,
      'safeTxGas' as const,
      'baseGas' as const,
      'gasPrice' as const,
      'nonce' as const,
    ])('should require %s', (field) => {
      const nestedTransaction = nestedTransactionDtoBuilder().build();
      delete nestedTransaction[field];
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with('nestedTransaction', nestedTransaction)
        .build();

      const result = ProposeTransactionDtoSchema.safeParse(
        proposeTransactionDto,
      );

      expect(!result.success && result.error.issues).toEqual([
        expect.objectContaining({
          path: ['nestedTransaction', field],
        }),
      ]);
    });

    it.each([
      'signatures',
      'safe',
      'chainId',
      'originName',
      'originUrl',
      'nestedTransaction',
    ])('should reject the unknown key %s', (key) => {
      const nestedTransaction = {
        ...nestedTransactionDtoBuilder().build(),
        [key]: faker.string.sample(),
      };
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with(
          'nestedTransaction',
          nestedTransaction as unknown as NestedTransactionDto,
        )
        .build();

      const result = ProposeTransactionDtoSchema.safeParse(
        proposeTransactionDto,
      );

      expect(!result.success && result.error.issues).toEqual([
        expect.objectContaining({
          code: 'unrecognized_keys',
          keys: [key],
          path: ['nestedTransaction'],
        }),
      ]);
    });

    it('should accept notes within the size bound', () => {
      const nestedTransaction = nestedTransactionDtoBuilder()
        .with('notes', 'a'.repeat(200))
        .build();
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with('nestedTransaction', nestedTransaction)
        .build();

      const result = ProposeTransactionDtoSchema.safeParse(
        proposeTransactionDto,
      );

      expect(result.success).toBe(true);
    });

    it('should reject notes exceeding 200 chars', () => {
      const nestedTransaction = nestedTransactionDtoBuilder()
        .with('notes', 'a'.repeat(201))
        .build();
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with('nestedTransaction', nestedTransaction)
        .build();

      const result = ProposeTransactionDtoSchema.safeParse(
        proposeTransactionDto,
      );

      expect(!result.success && result.error.issues).toEqual([
        expect.objectContaining({
          code: 'too_big',
          maximum: 200,
          path: ['nestedTransaction', 'notes'],
        }),
      ]);
    });

    it('should not allow a non-numeric nested nonce', () => {
      const nestedTransaction = nestedTransactionDtoBuilder()
        .with('nonce', faker.string.alpha())
        .build();
      const proposeTransactionDto = proposeTransactionDtoBuilder()
        .with('nestedTransaction', nestedTransaction)
        .build();

      const result = ProposeTransactionDtoSchema.safeParse(
        proposeTransactionDto,
      );

      expect(!result.success && result.error.issues).toEqual([
        expect.objectContaining({
          code: 'custom',
          message: 'Invalid base-10 numeric string',
          path: ['nestedTransaction', 'nonce'],
        }),
      ]);
    });
  });
});
