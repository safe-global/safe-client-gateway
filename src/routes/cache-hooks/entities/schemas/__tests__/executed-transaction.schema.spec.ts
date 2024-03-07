import { ExecutedTransactionEventSchema } from '@/routes/cache-hooks/entities/schemas/executed-transaction.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('ExecutedTransactionEventSchema', () => {
  const executedTransactionEvent = {
    type: 'EXECUTED_MULTISIG_TRANSACTION',
    address: faker.finance.ethereumAddress(),
    chainId: faker.string.numeric(),
    safeTxHash: faker.string.hexadecimal(),
    txHash: faker.string.hexadecimal(),
  };

  it('should validate an execution event', () => {
    const result = ExecutedTransactionEventSchema.safeParse(
      executedTransactionEvent,
    );

    expect(result.success).toBe(true);
  });

  it('should checksum the address', () => {
    const result = ExecutedTransactionEventSchema.safeParse(
      executedTransactionEvent,
    );

    expect(result.success && result.data.address).toBe(
      getAddress(executedTransactionEvent.address),
    );
  });

  it('should not allow an invalid execution event', () => {
    const invalidExecutedTransactionEvent = {
      invalid: 'executedTransactionEvent',
    };

    const result = ExecutedTransactionEventSchema.safeParse(
      invalidExecutedTransactionEvent,
    );

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        // @ts-expect-error - no type inferral for literal
        {
          code: 'invalid_literal',
          expected: 'EXECUTED_MULTISIG_TRANSACTION',
          path: ['type'],
          message:
            'Invalid literal value, expected "EXECUTED_MULTISIG_TRANSACTION"',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['address'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['chainId'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['safeTxHash'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['txHash'],
          message: 'Required',
        },
      ]),
    );
  });
});
