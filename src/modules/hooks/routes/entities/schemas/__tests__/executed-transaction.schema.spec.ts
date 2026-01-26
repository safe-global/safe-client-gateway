import { executedTransactionEventBuilder } from '@/modules/hooks/routes/entities/__tests__/executed-transaction.builder';
import type { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import { ExecutedTransactionEventSchema } from '@/modules/hooks/routes/entities/schemas/executed-transaction.schema';
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';

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
        faker.word.sample() as TransactionEventType.EXECUTED_MULTISIG_TRANSACTION,
      )
      .build();

    const result = ExecutedTransactionEventSchema.safeParse(
      executedTransactionEvent,
    );

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid_value',
        values: ['EXECUTED_MULTISIG_TRANSACTION'],
        path: ['type'],
        message: 'Invalid input: expected "EXECUTED_MULTISIG_TRANSACTION"',
      }),
    ]);
  });

  it.each(['to' as const, 'address' as const])(
    'should not allow a non-address %s',
    (field) => {
      const executedTransactionEvent = executedTransactionEventBuilder()
        .with(field, faker.string.sample() as Address)
        .build();

      const result = ExecutedTransactionEventSchema.safeParse(
        executedTransactionEvent,
      );

      expect(!result.success && result.error.issues).toEqual([
        expect.objectContaining({
          code: 'custom',
          message: 'Invalid address',
          path: [field],
        }),
      ]);
    },
  );

  it.each(['to' as const, 'address' as const])(
    'should checksum the %s',
    (field) => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase() as Address;
      const executedTransactionEvent = executedTransactionEventBuilder()
        .with(field, nonChecksummedAddress)
        .build();

      const result = ExecutedTransactionEventSchema.safeParse(
        executedTransactionEvent,
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
    'txHash' as const,
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

  it('should not allow a non-hex data', () => {
    const executedTransactionEvent = executedTransactionEventBuilder()
      .with('data', faker.string.sample() as Address)
      .build();

    const result = ExecutedTransactionEventSchema.safeParse(
      executedTransactionEvent,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid "0x" notated hex string',
        path: ['data'],
      },
    ]);
  });

  it('should allow undefined data', () => {
    const executedTransactionEvent = executedTransactionEventBuilder().build();
    delete executedTransactionEvent.data;

    const result = ExecutedTransactionEventSchema.safeParse(
      executedTransactionEvent,
    );

    expect(result.success && result.data.data).toBe(undefined);
  });

  it('should allow null data, defaulting to undefined', () => {
    const executedTransactionEvent = executedTransactionEventBuilder().build();
    // @ts-expect-error - inferred schema expects undefined
    executedTransactionEvent.data = null;

    const result = ExecutedTransactionEventSchema.safeParse(
      executedTransactionEvent,
    );

    expect(result.success && result.data.data).toBe(undefined);
  });
});
