import {
  alertBuilder,
  alertLogBuilder,
  alertTransactionBuilder,
} from '@/routes/alerts/entities/__tests__/alerts.builder';
import {
  AlertLogSchema,
  AlertSchema,
  AlertTransactionSchema,
} from '@/routes/alerts/entities/schemas/alerts.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('Alerts schemas', () => {
  describe('AlertLogSchema', () => {
    it('should validate an alert log', () => {
      const alertLog = alertLogBuilder().build();

      const result = AlertLogSchema.safeParse(alertLog);

      expect(result.success).toBe(true);
    });

    it('should checksum the alert log address', () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase() as `0x${string}`;
      const alertLog = alertLogBuilder()
        .with('address', nonChecksummedAddress)
        .build();

      const result = AlertLogSchema.safeParse(alertLog);

      expect(result.success && result.data.address).toBe(
        getAddress(alertLog.address),
      );
    });

    it('should allow empty alert log topics', () => {
      const alertLog = alertLogBuilder().with('topics', []).build();

      const result = AlertLogSchema.safeParse(alertLog);

      expect(result.success && result.data.topics).toStrictEqual([]);
    });

    it('should not allow invalid alert logs', () => {
      const alertLog = { invalid: 'log' };

      const result = AlertLogSchema.safeParse(alertLog);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['address'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'array',
            received: 'undefined',
            path: ['topics'],
            message: 'Required',
          },
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

  describe('AlertTransactionSchema', () => {
    it('should validate an alert transaction', () => {
      const alertTransaction = alertTransactionBuilder().build();

      const result = AlertTransactionSchema.safeParse(alertTransaction);

      expect(result.success).toBe(true);
    });

    it('should checksum the alert transaction from and to addresses', () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase() as `0x${string}`;
      const alertTransaction = alertTransactionBuilder()
        .with('from', nonChecksummedAddress)
        .with('to', nonChecksummedAddress)
        .build();

      const result = AlertTransactionSchema.safeParse(alertTransaction);

      expect(result.success && result.data.from).toBe(
        getAddress(alertTransaction.from),
      );
      expect(result.success && result.data.to).toBe(
        getAddress(alertTransaction.to),
      );
    });

    it('should not allow invalid alert transactions', () => {
      const alertTransaction = { invalid: 'transaction' };

      const result = AlertTransactionSchema.safeParse(alertTransaction);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['network'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['block_hash'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'number',
            received: 'undefined',
            path: ['block_number'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['hash'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['from'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['to'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'array',
            received: 'undefined',
            path: ['logs'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['input'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['value'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['nonce'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['gas'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['gas_used'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['cumulative_gas_used'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['gas_price'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['gas_tip_cap'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['gas_fee_cap'],
            message: 'Required',
          },
        ]),
      );
    });
  });

  describe('AlertSchema', () => {
    it('should validate an alert', () => {
      const alert = alertBuilder().build();

      const result = AlertSchema.safeParse(alert);

      expect(result.success).toBe(true);
    });

    it('should not allow invalid alerts', () => {
      const alert = { invalid: 'alert' };

      const result = AlertSchema.safeParse(alert);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['id'],
            message: 'Required',
          },
          // @ts-expect-error - enum values do not match inferred type
          {
            expected: "'ALERT' | 'TEST'",
            received: 'undefined',
            code: 'invalid_type',
            path: ['event_type'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'object',
            received: 'undefined',
            path: ['transaction'],
            message: 'Required',
          },
        ]),
      );
    });
  });
});
