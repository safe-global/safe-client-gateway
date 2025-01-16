import { pendingTransactionEventBuilder } from '@/routes/hooks/entities/__tests__/pending-transaction.builder';
import type { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import { PendingTransactionEventSchema } from '@/routes/hooks/entities/schemas/pending-transaction.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('PendingTransactionEventSchema', () => {
  it('should validate an pending transaction event', () => {
    const pendingTransactionEvent = pendingTransactionEventBuilder().build();

    const result = PendingTransactionEventSchema.safeParse(
      pendingTransactionEvent,
    );

    expect(result.success).toBe(true);
  });

  it('should not allow a non-PENDING_MULTISIG_TRANSACTION event', () => {
    const executedTransactionEvent = pendingTransactionEventBuilder()
      .with(
        'type',
        faker.word.sample() as TransactionEventType.PENDING_MULTISIG_TRANSACTION,
      )
      .build();

    const result = PendingTransactionEventSchema.safeParse(
      executedTransactionEvent,
    );

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          received: executedTransactionEvent.type,
          code: 'invalid_literal',
          expected: 'PENDING_MULTISIG_TRANSACTION',
          path: ['type'],
          message:
            'Invalid literal value, expected "PENDING_MULTISIG_TRANSACTION"',
        },
      ]),
    );
  });

  it.each(['to' as const, 'address' as const])(
    'should not allow a non-address %s',
    (field) => {
      const pendingTransactionEvent = pendingTransactionEventBuilder()
        .with(field, faker.string.sample() as `0x${string}`)
        .build();

      const result = PendingTransactionEventSchema.safeParse(
        pendingTransactionEvent,
      );

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'custom',
            message: 'Invalid address',
            path: [field],
          },
        ]),
      );
    },
  );

  it.each(['to' as const, 'address' as const])(
    'should checksum the %s',
    (field) => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase() as `0x${string}`;
      const pendingTransactionEvent = pendingTransactionEventBuilder()
        .with(field, nonChecksummedAddress)
        .build();

      const result = PendingTransactionEventSchema.safeParse(
        pendingTransactionEvent,
      );
      expect(result.success && result.data[field]).toBe(
        getAddress(nonChecksummedAddress),
      );
    },
  );

  it.each([
    'type' as const,
    'to' as const,
    'address' as const,
    'chainId' as const,
    'safeTxHash' as const,
  ])('should not allow a missing %s', (field) => {
    const pendingTransactionEvent = pendingTransactionEventBuilder().build();
    delete pendingTransactionEvent[field];

    const result = PendingTransactionEventSchema.safeParse(
      pendingTransactionEvent,
    );

    expect(
      !result.success &&
        result.error.issues.length === 1 &&
        result.error.issues[0].path.length === 1 &&
        result.error.issues[0].path[0] === field,
    ).toBe(true);
  });
});
