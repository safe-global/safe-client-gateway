import {
  transactionStatusReceiptBuilder,
  transactionStatusReceiptLogBuilder,
} from '@/datasources/staking-api/entities/__tests__/transaction-status.entity.builder';
import {
  TransactionStatusReceiptLogSchema,
  TransactionStatusReceiptSchema,
  TransactionStatusSchema,
} from '@/datasources/staking-api/entities/transaction-status.entity';
import { faker } from '@faker-js/faker/.';
import { getAddress } from 'viem';

describe('TransactionStatus', () => {
  describe('TransactionStatusReceiptLogSchema', () => {
    it('should validate a valid TransactionStatusReceiptLog', () => {
      const transactionStatusReceiptLog =
        transactionStatusReceiptLogBuilder().build();

      const result = TransactionStatusReceiptLogSchema.safeParse(
        transactionStatusReceiptLog,
      );

      expect(result.success).toBe(true);
    });

    it('not allow non-address address', () => {
      const transactionStatusReceiptLog = transactionStatusReceiptLogBuilder()
        .with('address', faker.string.numeric() as `0x${string}`)
        .build();

      const result = TransactionStatusReceiptLogSchema.safeParse(
        transactionStatusReceiptLog,
      );

      expect(!result.success && result.error.issues.length).toBe(1);
      expect(!result.success && result.error.issues[0]).toStrictEqual({
        code: 'custom',
        message: 'Invalid address',
        path: ['address'],
      });
    });

    it('should checksum the address', () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const transactionStatusReceiptLog = transactionStatusReceiptLogBuilder()
        .with('address', nonChecksummedAddress as `0x${string}`)
        .build();

      const result = TransactionStatusReceiptLogSchema.safeParse(
        transactionStatusReceiptLog,
      );

      expect(result.success && result.data.address).toBe(
        getAddress(nonChecksummedAddress),
      );
    });

    it('should not allow non-hex topics', () => {
      const transactionStatusReceiptLog = transactionStatusReceiptLogBuilder()
        .with('topics', [faker.string.alphanumeric() as `0x${string}`])
        .build();

      const result = TransactionStatusReceiptLogSchema.safeParse(
        transactionStatusReceiptLog,
      );

      expect(!result.success && result.error.issues.length).toBe(1);
      expect(!result.success && result.error.issues[0]).toStrictEqual({
        code: 'custom',
        message: 'Invalid "0x" notated hex string',
        path: ['topics', 0],
      });
    });

    it.each([
      'data' as const,
      'blockHash' as const,
      'blockTimestamp' as const,
      'transactionHash' as const,
    ])('should not allow non-hex %s', (field) => {
      const transactionStatusReceiptLog = transactionStatusReceiptLogBuilder()
        .with(field, faker.string.alphanumeric() as `0x${string}`)
        .build();

      const result = TransactionStatusReceiptLogSchema.safeParse(
        transactionStatusReceiptLog,
      );

      expect(!result.success && result.error.issues.length).toBe(1);
      expect(!result.success && result.error.issues[0]).toStrictEqual({
        code: 'custom',
        message: 'Invalid "0x" notated hex string',
        path: [field],
      });
    });

    it('should not allow a non-numeric string blockNumber', () => {
      const transactionStatusReceiptLog = transactionStatusReceiptLogBuilder()
        .with('blockNumber', faker.string.alpha())
        .build();

      const result = TransactionStatusReceiptLogSchema.safeParse(
        transactionStatusReceiptLog,
      );

      expect(!result.success && result.error.issues.length).toBe(1);
      expect(!result.success && result.error.issues[0]).toStrictEqual({
        code: 'custom',
        message: 'Invalid base-10 numeric string',
        path: ['blockNumber'],
      });
    });

    it.each(['transactionIndex' as const, 'logIndex' as const])(
      'should not allow a non-numeric %s',
      (field) => {
        const transactionStatusReceiptLog = transactionStatusReceiptLogBuilder()
          .with(field, faker.string.numeric() as unknown as number)
          .build();

        const result = TransactionStatusReceiptLogSchema.safeParse(
          transactionStatusReceiptLog,
        );

        expect(!result.success && result.error.issues.length).toBe(1);
        expect(!result.success && result.error.issues[0]).toStrictEqual({
          code: 'invalid_type',
          expected: 'number',
          message: 'Expected number, received string',
          path: [field],
          received: 'string',
        });
      },
    );

    it('should not allow a non-boolean removed', () => {
      const transactionStatusReceiptLog = transactionStatusReceiptLogBuilder()
        .with('removed', faker.string.alphanumeric() as unknown as boolean)
        .build();

      const result = TransactionStatusReceiptLogSchema.safeParse(
        transactionStatusReceiptLog,
      );

      expect(!result.success && result.error.issues.length).toBe(1);
      expect(!result.success && result.error.issues[0]).toStrictEqual({
        code: 'invalid_type',
        expected: 'boolean',
        message: 'Expected boolean, received string',
        path: ['removed'],
        received: 'string',
      });
    });

    it('should not validate and invalid TransactionStatusReceiptLog', () => {
      const transactionStatusReceiptLog = {
        invalid: 'transactionStatusReceiptLog',
      };

      const result = TransactionStatusReceiptLogSchema.safeParse(
        transactionStatusReceiptLog,
      );

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['address'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'array',
          message: 'Required',
          path: ['topics'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['data'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['blockHash'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['blockNumber'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['blockTimestamp'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['transactionHash'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'number',
          message: 'Required',
          path: ['transactionIndex'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'number',
          message: 'Required',
          path: ['logIndex'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'boolean',
          message: 'Required',
          path: ['removed'],
          received: 'undefined',
        },
      ]);
    });
  });

  describe('TransactionStatusReceiptSchema', () => {
    it('should validate a valid TransactionStatusReceipt', () => {
      const transactionStatusReceipt =
        transactionStatusReceiptBuilder().build();

      const result = TransactionStatusReceiptSchema.safeParse(
        transactionStatusReceipt,
      );

      expect(result.success).toBe(true);
    });

    it('should fallback to unknown status', () => {
      const transactionStatusReceipt = transactionStatusReceiptBuilder()
        .with('status', 'invalid' as 'success')
        .build();

      const result = TransactionStatusReceiptSchema.safeParse(
        transactionStatusReceipt,
      );

      expect(result.success && result.data.status).toBe('unknown');
    });

    it.each([
      'cumulativeGasUsed' as const,
      'blockNumber' as const,
      'gasUsed' as const,
      'effectiveGasPrice' as const,
    ])(`should not allow a non-numeric string %s`, (field) => {
      const transactionStatusReceipt = transactionStatusReceiptBuilder()
        .with(field, faker.string.alpha())
        .build();

      const result = TransactionStatusReceiptSchema.safeParse(
        transactionStatusReceipt,
      );

      expect(!result.success && result.error.issues.length).toBe(1);
      expect(!result.success && result.error.issues[0]).toStrictEqual({
        code: 'custom',
        message: 'Invalid base-10 numeric string',
        path: [field],
      });
    });

    it('should allow no topics', () => {
      const transactionStatusReceipt = transactionStatusReceiptBuilder()
        .with('logs', [])
        .build();

      const result = TransactionStatusReceiptSchema.safeParse(
        transactionStatusReceipt,
      );

      expect(result.success).toBe(true);
    });

    it('should fallback to unknown type', () => {
      const transactionStatusReceipt = transactionStatusReceiptBuilder()
        .with('type', 'invalid' as 'eip1559')
        .build();

      const result = TransactionStatusReceiptSchema.safeParse(
        transactionStatusReceipt,
      );

      expect(result.success && result.data.type).toBe('unknown');
    });

    it.each([
      'logsBloom' as const,
      'transactionHash' as const,
      'blockHash' as const,
    ])('should not allow a non-hex %s', (field) => {
      const transactionStatusReceipt = transactionStatusReceiptBuilder()
        .with(field, faker.string.alpha() as `0x${string}`)
        .build();

      const result = TransactionStatusReceiptSchema.safeParse(
        transactionStatusReceipt,
      );

      expect(!result.success && result.error.issues.length).toBe(1);
      expect(!result.success && result.error.issues[0]).toStrictEqual({
        code: 'custom',
        message: 'Invalid "0x" notated hex string',
        path: [field],
      });
    });

    it('should not allow a non-numeric string transactionIndex', () => {
      const transactionStatusReceipt = transactionStatusReceiptBuilder()
        .with('transactionIndex', faker.string.numeric() as unknown as number)
        .build();

      const result = TransactionStatusReceiptSchema.safeParse(
        transactionStatusReceipt,
      );

      expect(!result.success && result.error.issues.length).toBe(1);
      expect(!result.success && result.error.issues[0]).toStrictEqual({
        code: 'invalid_type',
        expected: 'number',
        message: 'Expected number, received string',
        path: ['transactionIndex'],
        received: 'string',
      });
    });

    it.each(['from' as const, 'to' as const, 'contractAddress' as const])(
      'should not allow a non-address %s',
      (field) => {
        const transactionStatusReceipt = transactionStatusReceiptBuilder()
          .with(field, faker.string.numeric() as `0x${string}`)
          .build();

        const result = TransactionStatusReceiptSchema.safeParse(
          transactionStatusReceipt,
        );

        expect(!result.success && result.error.issues.length).toBe(1);
        expect(!result.success && result.error.issues[0]).toStrictEqual({
          code: 'custom',
          message: 'Invalid address',
          path: [field],
        });
      },
    );

    it.each(['from' as const, 'to' as const, 'contractAddress' as const])(
      'should checksum the %s',
      (field) => {
        const nonChecksummedAddress = faker.finance
          .ethereumAddress()
          .toLowerCase();
        const transactionStatusReceipt = transactionStatusReceiptBuilder()
          .with(field, nonChecksummedAddress as `0x${string}`)
          .build();

        const result = TransactionStatusReceiptSchema.safeParse(
          transactionStatusReceipt,
        );

        expect(result.success && result.data[field]).toBe(
          getAddress(nonChecksummedAddress),
        );
      },
    );

    it('should default contractAddress to null', () => {
      const transactionStatusReceipt =
        transactionStatusReceiptBuilder().build();
      // @ts-expect-error - undefined contractAddress not valid
      delete transactionStatusReceipt.contractAddress;

      const result = TransactionStatusReceiptSchema.safeParse(
        transactionStatusReceipt,
      );

      expect(result.success && result.data.contractAddress).toBe(null);
    });

    it('should not validate an invalid TransactionStatusReceipt', () => {
      const transactionStatusReceipt = {
        invalid: 'transactionStatusReceipt',
      };

      const result = TransactionStatusReceiptSchema.safeParse(
        transactionStatusReceipt,
      );

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['cumulativeGasUsed'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'array',
          message: 'Required',
          path: ['logs'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['logsBloom'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['transactionHash'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'number',
          message: 'Required',
          path: ['transactionIndex'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['blockHash'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['blockNumber'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['gasUsed'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['effectiveGasPrice'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['from'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['to'],
          received: 'undefined',
        },
      ]);
    });
  });

  describe('TransactionStatusSchema', () => {
    it('should validate a valid TransactionStatus', () => {
      const transactionStatus = {
        receipt: transactionStatusReceiptBuilder().build(),
        status: 'success',
      };

      const result = TransactionStatusSchema.safeParse(transactionStatus);

      expect(result.success).toBe(true);
    });

    it('should fallback to unknown status', () => {
      const transactionStatus = {
        receipt: transactionStatusReceiptBuilder().build(),
        status: 'invalid' as 'success',
      };

      const result = TransactionStatusSchema.safeParse(transactionStatus);

      expect(result.success && result.data.status).toBe('unknown');
    });

    it('should not validate an invalid TransactionStatus', () => {
      const transactionStatus = {
        invalid: 'transactionStatus',
      };

      const result = TransactionStatusSchema.safeParse(transactionStatus);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'object',
          message: 'Required',
          path: ['receipt'],
          received: 'undefined',
        },
      ]);
    });
  });
});
