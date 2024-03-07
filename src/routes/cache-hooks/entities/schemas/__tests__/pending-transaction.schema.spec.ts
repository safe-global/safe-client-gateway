import { PendingTransactionEventSchema } from '@/routes/cache-hooks/entities/schemas/pending-transaction.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('PendingTransactionEventSchema', () => {
  const pendingTransactionEvent = {
    type: 'PENDING_MULTISIG_TRANSACTION',
    address: faker.finance.ethereumAddress(),
    chainId: faker.string.numeric(),
    safeTxHash: faker.string.hexadecimal(),
  };

  it('should validate an pending event', () => {
    const result = PendingTransactionEventSchema.safeParse(
      pendingTransactionEvent,
    );

    expect(result.success).toBe(true);
  });

  it('should checksum the address', () => {
    const result = PendingTransactionEventSchema.safeParse(
      pendingTransactionEvent,
    );

    expect(result.success && result.data.address).toBe(
      getAddress(pendingTransactionEvent.address),
    );
  });

  it('should not allow an invalid pending event', () => {
    const invalidPendingTransactionEvent = {
      invalid: 'pendingTransactionEvent',
    };

    const result = PendingTransactionEventSchema.safeParse(
      invalidPendingTransactionEvent,
    );

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        // @ts-expect-error - no type inferral for literal
        {
          code: 'invalid_literal',
          expected: 'PENDING_MULTISIG_TRANSACTION',
          path: ['type'],
          message:
            'Invalid literal value, expected "PENDING_MULTISIG_TRANSACTION"',
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
      ]),
    );
  });
});
