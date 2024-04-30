import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { Page } from '@/domain/entities/page.entity';
import { moduleTransactionBuilder } from '@/domain/safe/entities/__tests__/module-transaction.builder';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import {
  ModuleTransactionPageSchema,
  ModuleTransactionSchema,
} from '@/domain/safe/entities/module-transaction.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('ModuleTransaction schemas', () => {
  describe('ModuleTransactionSchema', () => {
    it('should validate a valid ModuleTransaction', () => {
      const moduleTransaction = moduleTransactionBuilder().build();

      const result = ModuleTransactionSchema.safeParse(moduleTransaction);

      expect(result.success).toBe(true);
    });

    it.each(['safe' as const, 'to' as const, 'module' as const])(
      'should checksum the %s',
      (key) => {
        const nonChecksummedAddress = faker.finance
          .ethereumAddress()
          .toLowerCase() as `0x${string}`;
        const moduleTransaction = moduleTransactionBuilder()
          .with(key, nonChecksummedAddress)
          .build();

        const result = ModuleTransactionSchema.safeParse(moduleTransaction);

        expect(result.success && result.data[key]).toBe(
          getAddress(nonChecksummedAddress),
        );
      },
    );

    it.each(['value' as const, 'data' as const, 'dataDecoded' as const])(
      'should allow %s to be undefined, defaulting to null',
      (key) => {
        const moduleTransaction = moduleTransactionBuilder().build();
        delete moduleTransaction[key];

        const result = ModuleTransactionSchema.safeParse(moduleTransaction);

        expect(result.success && result.data[key]).toBe(null);
      },
    );

    it.each(['data' as const, 'transactionHash' as const])(
      'should not allow non-hex %s',
      (key) => {
        const moduleTransaction = moduleTransactionBuilder()
          .with(key, faker.string.numeric() as `0x${string}`)
          .build();

        const result = ModuleTransactionSchema.safeParse(moduleTransaction);

        expect(!result.success && result.error).toStrictEqual(
          new ZodError([
            {
              code: 'custom',
              message: 'Invalid "0x" notated hex string',
              path: [key],
            },
          ]),
        );
      },
    );

    it('should not allow an invalid operation', () => {
      const moduleTransaction = moduleTransactionBuilder()
        .with('operation', 2 as unknown as 0 | 1)
        .build();

      const result = ModuleTransactionSchema.safeParse(moduleTransaction);

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

    it.each(['created' as const, 'executionDate' as const])(
      'should coerce %s to a date',
      (key) => {
        const moduleTransaction = moduleTransactionBuilder()
          .with(key, faker.date.recent().toISOString() as unknown as Date)
          .build();

        const result = ModuleTransactionSchema.safeParse(moduleTransaction);

        expect(result.success && result.data[key]).toStrictEqual(
          new Date(moduleTransaction[key]),
        );
      },
    );

    it('should not allow an invalid blockNumber', () => {
      const moduleTransaction = moduleTransactionBuilder()
        .with('blockNumber', faker.string.numeric() as unknown as number)
        .build();

      const result = ModuleTransactionSchema.safeParse(moduleTransaction);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'number',
            received: 'string',
            path: ['blockNumber'],
            message: 'Expected number, received string',
          },
        ]),
      );
    });

    it('should not allow an invalid isSuccessful', () => {
      const moduleTransaction = moduleTransactionBuilder()
        .with('isSuccessful', faker.string.numeric() as unknown as boolean)
        .build();

      const result = ModuleTransactionSchema.safeParse(moduleTransaction);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'boolean',
            received: 'string',
            path: ['isSuccessful'],
            message: 'Expected boolean, received string',
          },
        ]),
      );
    });

    it('should not allow an invalid moduleTransactionId', () => {
      const moduleTransaction = moduleTransactionBuilder()
        .with('moduleTransactionId', faker.number.int() as unknown as string)
        .build();

      const result = ModuleTransactionSchema.safeParse(moduleTransaction);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['moduleTransactionId'],
            message: 'Expected string, received number',
          },
        ]),
      );
    });
  });

  describe('ModuleTransactionPageSchema', () => {
    it('should validate a valid Page<ModuleTransaction>', () => {
      const moduleTransactionPage = pageBuilder()
        .with('results', [moduleTransactionBuilder().build()])
        .build();

      const result = ModuleTransactionPageSchema.safeParse(
        moduleTransactionPage,
      );

      expect(result.success).toBe(true);
    });

    it('should allow empty pages', () => {
      const moduleTransactionPage = pageBuilder().with('results', []).build();

      const result = ModuleTransactionPageSchema.safeParse(
        moduleTransactionPage,
      );

      expect(result.success).toBe(true);
    });

    it.each<keyof Page<ModuleTransaction>>([
      'count',
      'next',
      'previous',
      'results',
    ])('should not allow %s to be undefined', (key) => {
      const moduleTransactionPage = pageBuilder().with('results', []).build();
      delete moduleTransactionPage[key];

      const result = ModuleTransactionPageSchema.safeParse(
        moduleTransactionPage,
      );

      expect(
        !result.success &&
          result.error.issues.length === 1 &&
          result.error.issues[0].path.length === 1 &&
          result.error.issues[0].path[0] === key,
      ).toBe(true);
    });
  });
});
