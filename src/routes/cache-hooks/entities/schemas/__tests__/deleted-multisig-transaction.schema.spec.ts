import { DeletedMultisigTransactionEventSchema } from '@/routes/cache-hooks/entities/schemas/deleted-multisig-transaction.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('DeletedMultisigTransactionEventSchema', () => {
  const deletedMultisigTransactionEvent = {
    type: 'DELETED_MULTISIG_TRANSACTION',
    address: faker.finance.ethereumAddress(),
    chainId: faker.string.numeric(),
    safeTxHash: faker.string.hexadecimal(),
  };

  it('should validate a valid delete event', () => {
    const result = DeletedMultisigTransactionEventSchema.safeParse(
      deletedMultisigTransactionEvent,
    );

    expect(result.success).toBe(true);
  });

  it('should checksum the address', () => {
    const result = DeletedMultisigTransactionEventSchema.safeParse(
      deletedMultisigTransactionEvent,
    );

    expect(result.success && result.data.address).toBe(
      getAddress(deletedMultisigTransactionEvent.address),
    );
  });

  it('should not allow an invalid delete event', () => {
    const invalidDeletedMultisigTransactionEvent = {
      invalid: 'deletedMultisigTransactionEvent',
    };

    const result = DeletedMultisigTransactionEventSchema.safeParse(
      invalidDeletedMultisigTransactionEvent,
    );

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        // @ts-expect-error - no type inferral for literal
        {
          code: 'invalid_literal',
          expected: 'DELETED_MULTISIG_TRANSACTION',
          path: ['type'],
          message:
            'Invalid literal value, expected "DELETED_MULTISIG_TRANSACTION"',
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
