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

    it('should not allow non-hex data', () => {
      const transactionStatusReceiptLog = transactionStatusReceiptLogBuilder()
        .with('data', faker.string.alphanumeric() as `0x${string}`)
        .build();

      const result = TransactionStatusReceiptLogSchema.safeParse(
        transactionStatusReceiptLog,
      );

      expect(!result.success && result.error.issues.length).toBe(1);
      expect(!result.success && result.error.issues[0]).toStrictEqual({
        code: 'custom',
        message: 'Invalid "0x" notated hex string',
        path: ['data'],
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

    it('should allow no logs', () => {
      const transactionStatusReceipt = transactionStatusReceiptBuilder()
        .with('logs', [])
        .build();

      const result = TransactionStatusReceiptSchema.safeParse(
        transactionStatusReceipt,
      );

      expect(result.success).toBe(true);
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
          expected: 'array',
          message: 'Required',
          path: ['logs'],
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
