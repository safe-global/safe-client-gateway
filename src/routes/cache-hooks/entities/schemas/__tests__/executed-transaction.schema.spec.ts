import { executedTransactionEventBuilder } from '@/routes/cache-hooks/entities/__tests__/executed-transaction.builder';
import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { ExecutedTransactionEventSchema } from '@/routes/cache-hooks/entities/schemas/executed-transaction.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('ExecutedTransactionEventSchema', () => {
  it('should validate an execution event', () => {
    const executedTransactionEvent = executedTransactionEventBuilder().build();

    const result = ExecutedTransactionEventSchema.safeParse(
      executedTransactionEvent,
    );

    expect(result.success).toBe(true);
  });

  it('should not allow a non-EXECUTED_MULTISIG_TRANSACTION event', () => {
    const executedTransactionEvent = executedTransactionEventBuilder()
      .with(
        'type',
        faker.word.sample() as EventType.EXECUTED_MULTISIG_TRANSACTION,
      )
      .build();

    const result = ExecutedTransactionEventSchema.safeParse(
      executedTransactionEvent,
    );

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          received: executedTransactionEvent.type,
          code: 'invalid_literal',
          expected: 'EXECUTED_MULTISIG_TRANSACTION',
          path: ['type'],
          message:
            'Invalid literal value, expected "EXECUTED_MULTISIG_TRANSACTION"',
        },
      ]),
    );
  });

  it('should not allow a non-address address', () => {
    const executedTransactionEvent = executedTransactionEventBuilder()
      .with('address', faker.string.sample() as `0x${string}`)
      .build();

    const result = ExecutedTransactionEventSchema.safeParse(
      executedTransactionEvent,
    );

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'custom',
          path: ['address'],
          message: 'Invalid input',
        },
      ]),
    );
  });

  it('should checksum the address', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as `0x${string}`;
    const executedTransactionEvent = executedTransactionEventBuilder()
      .with('address', nonChecksummedAddress)
      .build();

    const result = ExecutedTransactionEventSchema.safeParse(
      executedTransactionEvent,
    );
    expect(result.success && result.data.address).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it.each([
    ['type' as const],
    ['address' as const],
    ['chainId' as const],
    ['safeTxHash' as const],
    ['txHash' as const],
  ])('should not allow a missing %s', (field) => {
    const executedTransactionEvent = executedTransactionEventBuilder().build();
    delete executedTransactionEvent[field];

    const result = ExecutedTransactionEventSchema.safeParse(
      executedTransactionEvent,
    );

    expect(
      !result.success &&
        result.error.issues.length === 1 &&
        result.error.issues[0].path.length === 1 &&
        result.error.issues[0].path[0] === field,
    ).toBe(true);
  });
});
