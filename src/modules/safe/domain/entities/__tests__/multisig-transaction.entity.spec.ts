import { confirmationBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction-confirmation.builder';
import { multisigTransactionBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import {
  ConfirmationSchema,
  MultisigTransactionPageSchema,
  MultisigTransactionSchema,
  MultisigTransactionTypeSchema,
} from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { faker } from '@faker-js/faker/.';
import { type Address, getAddress } from 'viem';

describe('MultisigTransaction', () => {
  describe('ConfirmationSchema', () => {
    it('should validate a Confirmation', () => {
      const confirmation = confirmationBuilder().build();

      const result = ConfirmationSchema.safeParse(confirmation);

      expect(result.success).toBe(true);
    });

    it('should not validate and invalid Confirmation', () => {
      const confirmation = {
        invalid: 'confirmation',
      };

      const result = ConfirmationSchema.safeParse(confirmation);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['owner'],
        },
        {
          code: 'invalid_type',
          expected: 'date',
          message: 'Invalid input: expected date, received Date',
          path: ['submissionDate'],
          received: 'Invalid Date',
        },
        {
          code: 'invalid_value',
          message:
            'Invalid option: expected one of "CONTRACT_SIGNATURE"|"APPROVED_HASH"|"EOA"|"ETH_SIGN"',
          path: ['signatureType'],
          values: ['CONTRACT_SIGNATURE', 'APPROVED_HASH', 'EOA', 'ETH_SIGN'],
        },
      ]);
    });
  });

  describe('MultisigTransactionSchema', () => {
    it('should validate a MultisigTransaction', () => {
      const multisigTransaction = multisigTransactionBuilder().build();

      const result = MultisigTransactionSchema.safeParse(multisigTransaction);

      expect(result.success).toBe(true);
    });

    it.each([
      'safe' as const,
      'to' as const,
      'value' as const,
      'operation' as const,
      'nonce' as const,
      'submissionDate' as const,
      'safeTxHash' as const,
      'isExecuted' as const,
      'confirmationsRequired' as const,
      'trusted' as const,
    ])('should require %s', (key) => {
      const multisigTransaction = multisigTransactionBuilder().build();
      delete multisigTransaction[key];

      const result = MultisigTransactionSchema.safeParse(multisigTransaction);

      expect(!result.success && result.error.issues.length).toBe(1);
      expect(!result.success && result.error.issues[0].path).toStrictEqual([
        key,
      ]);
    });

    it.each([
      'safe' as const,
      'to' as const,
      'gasToken' as const,
      'proposer' as const,
      'proposedByDelegate' as const,
      'refundReceiver' as const,
      'executor' as const,
    ])('should checksum %s', (key) => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const multisigTransaction = multisigTransactionBuilder()
        .with(key, nonChecksummedAddress as Address)
        .build();

      const result = MultisigTransactionSchema.safeParse(multisigTransaction);

      expect(result.success && result.data[key]).toBe(
        getAddress(nonChecksummedAddress),
      );
    });

    it.each([
      'value' as const,
      'gasPrice' as const,
      'ethGasPrice' as const,
      'fee' as const,
    ])('should require %s to be a numeric string', (key) => {
      const multisigTransaction = multisigTransactionBuilder()
        .with(key, faker.string.alpha())
        .build();

      const result = MultisigTransactionSchema.safeParse(multisigTransaction);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'custom',
          message: 'Invalid base-10 numeric string',
          path: [key],
        },
      ]);
    });

    it.each([
      'data' as const,
      'transactionHash' as const,
      'safeTxHash' as const,
    ])('should require %s to be a hex string', (key) => {
      const multisigTransaction = multisigTransactionBuilder()
        .with(key, faker.string.numeric() as Address)
        .build();

      const result = MultisigTransactionSchema.safeParse(multisigTransaction);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'custom',
          message: 'Invalid "0x" notated hex string',
          path: [key],
        },
      ]);
    });

    it.each([
      'data' as const,
      'gasToken' as const,
      'safeTxGas' as const,
      'baseGas' as const,
      'gasPrice' as const,
      'proposer' as const,
      'proposedByDelegate' as const,
      'refundReceiver' as const,
      'executionDate' as const,
      'modified' as const,
      'blockNumber' as const,
      'transactionHash' as const,
      'executor' as const,
      'isSuccessful' as const,
      'ethGasPrice' as const,
      'gasUsed' as const,
      'fee' as const,
      'origin' as const,
      'confirmations' as const,
      'signatures' as const,
    ])('should default %s to null', (key) => {
      const multisigTransaction = multisigTransactionBuilder().build();
      delete multisigTransaction[key];

      const result = MultisigTransactionSchema.safeParse(multisigTransaction);

      expect(result.success && result.data[key]).toBe(null);
    });

    it('should require operation to be 0 or 1', () => {
      const multisigTransaction = multisigTransactionBuilder()
        .with('operation', faker.number.int({ min: 2 }))
        .build();

      const result = MultisigTransactionSchema.safeParse(multisigTransaction);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_value',
          message: 'Invalid option: expected one of 0|1',
          path: ['operation'],
          values: [0, 1],
        },
      ]);
    });

    it.each([
      'executionDate' as const,
      'submissionDate' as const,
      'modified' as const,
    ])('should coerce %s to be a Date', (key) => {
      const date = faker.date.recent();
      const multisigTransaction = multisigTransactionBuilder()
        .with(key, date.toString() as unknown as Date)
        .build();

      const result = MultisigTransactionSchema.safeParse(multisigTransaction);

      // zod coerces to nearest millisecond
      date.setMilliseconds(0);
      expect(result.success && result.data[key]).toStrictEqual(date);
    });

    it('should not validate an invalid MultisigTransaction', () => {
      const multisigTransaction = {
        invalid: 'multisigTransaction',
      };

      const result = MultisigTransactionSchema.safeParse(multisigTransaction);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['to'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['value'],
        },
        {
          code: 'invalid_value',
          message: 'Invalid option: expected one of 0|1',
          path: ['operation'],
          values: [0, 1],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['safe'],
        },
        {
          code: 'invalid_union',
          message: 'Invalid input',
          path: ['nonce'],
          errors: [
            [
              {
                code: 'invalid_type',
                expected: 'number',
                message: 'Invalid input: expected number, received undefined',
                path: [],
              },
            ],
            [
              {
                code: 'invalid_type',
                expected: 'string',
                message: 'Invalid input: expected string, received undefined',
                path: [],
              },
            ],
          ],
        },
        {
          code: 'invalid_type',
          expected: 'date',
          message: 'Invalid input: expected date, received Date',
          path: ['submissionDate'],
          received: 'Invalid Date',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['safeTxHash'],
        },
        {
          code: 'invalid_type',
          expected: 'boolean',
          message: 'Invalid input: expected boolean, received undefined',
          path: ['isExecuted'],
        },
        {
          code: 'invalid_type',
          expected: 'number',
          message: 'Invalid input: expected number, received undefined',
          path: ['confirmationsRequired'],
        },
        {
          code: 'invalid_type',
          expected: 'boolean',
          message: 'Invalid input: expected boolean, received undefined',
          path: ['trusted'],
        },
      ]);
    });
  });

  describe('MultisigTransactionTypeSchema', () => {
    it('should validate a MultisigTransactionType', () => {
      const multisigTransactionType = {
        ...multisigTransactionBuilder().build(),
        txType: 'MULTISIG_TRANSACTION',
      };

      const result = MultisigTransactionTypeSchema.safeParse(
        multisigTransactionType,
      );

      expect(result.success).toBe(true);
    });

    it('should not validate an invalid MultisigTransactionType', () => {
      const multisigTransactionType = {
        invalid: 'multisigTransactionType',
      };

      const result = MultisigTransactionTypeSchema.safeParse(
        multisigTransactionType,
      );

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['to'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['value'],
        },
        {
          code: 'invalid_value',
          message: 'Invalid option: expected one of 0|1',
          path: ['operation'],
          values: [0, 1],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['safe'],
        },
        {
          code: 'invalid_union',
          message: 'Invalid input',
          path: ['nonce'],
          errors: [
            [
              {
                code: 'invalid_type',
                expected: 'number',
                message: 'Invalid input: expected number, received undefined',
                path: [],
              },
            ],
            [
              {
                code: 'invalid_type',
                expected: 'string',
                message: 'Invalid input: expected string, received undefined',
                path: [],
              },
            ],
          ],
        },
        {
          code: 'invalid_type',
          expected: 'date',
          message: 'Invalid input: expected date, received Date',
          path: ['submissionDate'],
          received: 'Invalid Date',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['safeTxHash'],
        },
        {
          code: 'invalid_type',
          expected: 'boolean',
          message: 'Invalid input: expected boolean, received undefined',
          path: ['isExecuted'],
        },
        {
          code: 'invalid_type',
          expected: 'number',
          message: 'Invalid input: expected number, received undefined',
          path: ['confirmationsRequired'],
        },
        {
          code: 'invalid_type',
          expected: 'boolean',
          message: 'Invalid input: expected boolean, received undefined',
          path: ['trusted'],
        },
        {
          code: 'invalid_value',
          message: 'Invalid input: expected "MULTISIG_TRANSACTION"',
          path: ['txType'],
          values: ['MULTISIG_TRANSACTION'],
        },
      ]);
    });
  });

  describe('MultisigTransactionPageSchema', () => {
    it('should validate a MultisigTransactionPage', () => {
      const multisigTransactionType = {
        ...multisigTransactionBuilder().build(),
        type: 'MULTISIG_TRANSACTION',
      };
      const multisigTransactionPage = pageBuilder()
        .with('count', 1)
        .with('results', [multisigTransactionType])
        .build();

      const result = MultisigTransactionPageSchema.safeParse(
        multisigTransactionPage,
      );

      expect(result.success).toBe(true);
    });

    it('should not validate an invalid MultisigTransactionPage', () => {
      const multisigTransactionPage = {
        invalid: 'multisigTransactionPage',
      };

      const result = MultisigTransactionPageSchema.safeParse(
        multisigTransactionPage,
      );

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'number',
          message: 'Invalid input: expected number, received undefined',
          path: ['count'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['next'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['previous'],
        },
        {
          code: 'invalid_type',
          expected: 'array',
          message: 'Invalid input: expected array, received undefined',
          path: ['results'],
        },
      ]);
    });
  });
});
