import { deletedMultisigTransactionEventBuilder } from '@/modules/hooks/routes/entities/__tests__/deleted-multisig-transaction.builder';
import type { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import { DeletedMultisigTransactionEventSchema } from '@/modules/hooks/routes/entities/schemas/deleted-multisig-transaction.schema';
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';

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
          faker.word.sample() as TransactionEventType.DELETED_MULTISIG_TRANSACTION,
        )
        .build();

    const result = DeletedMultisigTransactionEventSchema.safeParse(
      deletedMultisigTransactionEvent,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_value',
        path: ['type'],
        message: 'Invalid input: expected "DELETED_MULTISIG_TRANSACTION"',
        values: ['DELETED_MULTISIG_TRANSACTION'],
      },
    ]);
  });

  it('should not allow a non-address address', () => {
    const deletedMultisigTransactionEvent =
      deletedMultisigTransactionEventBuilder()
        .with('address', faker.string.alpha() as Address)
        .build();

    const result = DeletedMultisigTransactionEventSchema.safeParse(
      deletedMultisigTransactionEvent,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid address',
        path: ['address'],
      },
    ]);
  });

  it('should checksum the address', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as Address;
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
