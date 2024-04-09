import { deletedMultisigTransactionEventBuilder } from '@/routes/cache-hooks/entities/__tests__/deleted-multisig-transaction.builder';
import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { DeletedMultisigTransactionEventSchema } from '@/routes/cache-hooks/entities/schemas/deleted-multisig-transaction.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('DeletedMultisigTransactionEventSchema', () => {
  it('should validate a valid delete event', () => {
    const deletedMultisigTransactionEvent =
      deletedMultisigTransactionEventBuilder().build();

    const result = DeletedMultisigTransactionEventSchema.safeParse(
      deletedMultisigTransactionEvent,
    );

    expect(result.success).toBe(true);
  });

  it('should not allow a non-DELETED_MULTISIG_TRANSACTION event', () => {
    const deletedMultisigTransactionEvent =
      deletedMultisigTransactionEventBuilder()
        .with(
          'type',
          faker.word.sample() as EventType.DELETED_MULTISIG_TRANSACTION,
        )
        .build();

    const result = DeletedMultisigTransactionEventSchema.safeParse(
      deletedMultisigTransactionEvent,
    );

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          received: deletedMultisigTransactionEvent.type,
          code: 'invalid_literal',
          expected: 'DELETED_MULTISIG_TRANSACTION',
          path: ['type'],
          message:
            'Invalid literal value, expected "DELETED_MULTISIG_TRANSACTION"',
        },
      ]),
    );
  });

  it('should not allow a non-address address', () => {
    const deletedMultisigTransactionEvent =
      deletedMultisigTransactionEventBuilder()
        .with('address', faker.string.alpha() as `0x${string}`)
        .build();

    const result = DeletedMultisigTransactionEventSchema.safeParse(
      deletedMultisigTransactionEvent,
    );

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'custom',
          message: 'Invalid address',
          path: ['address'],
        },
      ]),
    );
  });

  it('should checksum the address', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as `0x${string}`;
    const deletedMultisigTransactionEvent =
      deletedMultisigTransactionEventBuilder()
        .with('address', nonChecksummedAddress)
        .build();

    const result = DeletedMultisigTransactionEventSchema.safeParse(
      deletedMultisigTransactionEvent,
    );

    expect(result.success && result.data.address).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it.each([
    'type' as const,
    'address' as const,
    'chainId' as const,
    'safeTxHash' as const,
  ])('should not allow a missing %s', (field) => {
    const deletedMultisigTransactionEvent =
      deletedMultisigTransactionEventBuilder().build();
    delete deletedMultisigTransactionEvent[field];

    const result = DeletedMultisigTransactionEventSchema.safeParse(
      deletedMultisigTransactionEvent,
    );

    expect(
      !result.success &&
        result.error.issues.length === 1 &&
        result.error.issues[0].path.length === 1 &&
        result.error.issues[0].path[0] === field,
    ).toBe(true);
  });
});
