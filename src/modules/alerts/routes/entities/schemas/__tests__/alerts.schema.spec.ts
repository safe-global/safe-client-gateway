import {
  alertBuilder,
  alertLogBuilder,
  alertTransactionBuilder,
} from '@/modules/alerts/routes/entities/__tests__/alerts.builder';
import {
  AlertLogSchema,
  AlertSchema,
  AlertTransactionSchema,
} from '@/modules/alerts/routes/entities/schemas/alerts.schema';
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';

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
        .toLowerCase() as Address;
      const alertLog = alertLogBuilder()
        .with('address', nonChecksummedAddress)
        .build();

      const result = AlertLogSchema.safeParse(alertLog);

      expect(result.success && result.data.address).toBe(
        getAddress(alertLog.address),
      );
    });

    it('should not allow empty alert log event signature', () => {
      const alertLog = alertLogBuilder()
        .with('topics', [] as unknown as [Address, ...Array<Address>])
        .build();

      const result = AlertLogSchema.safeParse(alertLog);

      expect(!result.success && result.error.issues.length).toBe(1);
      expect(!result.success && result.error.issues[0]).toStrictEqual({
        code: 'too_small',
        inclusive: true,
        minimum: 1,
        message: 'No event signature found',
        origin: 'array',
        path: ['topics'],
      });
    });

    it('should not allow invalid alert logs', () => {
      const alertLog = { invalid: 'log' };

      const result = AlertLogSchema.safeParse(alertLog);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['address'],
        },
        {
          code: 'invalid_type',
          expected: 'array',
          message: 'Invalid input: expected array, received undefined',
          path: ['topics'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['data'],
        },
      ]);
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
        .toLowerCase() as Address;
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

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['network'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['block_hash'],
        },
        {
          code: 'invalid_type',
          expected: 'number',
          message: 'Invalid input: expected number, received undefined',
          path: ['block_number'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['hash'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['from'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['to'],
        },
        {
          code: 'invalid_type',
          expected: 'array',
          message: 'Invalid input: expected array, received undefined',
          path: ['logs'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['input'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['value'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['nonce'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['gas'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['gas_used'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['cumulative_gas_used'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['gas_price'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['gas_tip_cap'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['gas_fee_cap'],
        },
      ]);
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

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['id'],
        },
        {
          code: 'invalid_value',
          message: 'Invalid option: expected one of "ALERT"|"TEST"',
          path: ['event_type'],
          values: ['ALERT', 'TEST'],
        },
        {
          code: 'invalid_type',
          expected: 'object',
          message: 'Invalid input: expected object, received undefined',
          path: ['transaction'],
        },
      ]);
    });
  });
});
