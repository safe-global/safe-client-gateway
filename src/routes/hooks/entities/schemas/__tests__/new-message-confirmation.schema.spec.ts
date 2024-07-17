import { newMessageConfirmationEventBuilder } from '@/routes/hooks/entities/__tests__/new-message-confirmation.builder';
import { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import { NewMessageConfirmationEventSchema } from '@/routes/hooks/entities/schemas/new-message-confirmation.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('NewMessageConfirmationEventSchema', () => {
  it('should validate a message confirmation event', () => {
    const newMessageConfirmationEvent =
      newMessageConfirmationEventBuilder().build();

    const result = NewMessageConfirmationEventSchema.safeParse(
      newMessageConfirmationEvent,
    );

    expect(result.success).toBe(true);
  });

  it('should not allow a non-MESSAGE_CONFIRMATION event', () => {
    const newMessageConfirmationEvent = newMessageConfirmationEventBuilder()
      .with(
        'type',
        faker.word.sample() as TransactionEventType.MESSAGE_CONFIRMATION,
      )
      .build();

    const result = NewMessageConfirmationEventSchema.safeParse(
      newMessageConfirmationEvent,
    );

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          received: newMessageConfirmationEvent.type,
          code: 'invalid_literal',
          expected: 'MESSAGE_CONFIRMATION',
          path: ['type'],
          message: 'Invalid literal value, expected "MESSAGE_CONFIRMATION"',
        },
      ]),
    );
  });

  it('should not allow non-address address', () => {
    const newMessageConfirmationEvent = newMessageConfirmationEventBuilder()
      .with('address', faker.string.alpha() as `0x${string}`)
      .build();

    const result = NewMessageConfirmationEventSchema.safeParse(
      newMessageConfirmationEvent,
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
    const newMessageConfirmationEvent = newMessageConfirmationEventBuilder()
      .with('address', nonChecksummedAddress)
      .build();

    const result = NewMessageConfirmationEventSchema.safeParse(
      newMessageConfirmationEvent,
    );

    expect(result.success && result.data.address).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it.each([
    'type' as const,
    'address' as const,
    'chainId' as const,
    'messageHash' as const,
  ])('should not allow a missing %s', (field) => {
    const newMessageConfirmationEvent =
      newMessageConfirmationEventBuilder().build();
    delete newMessageConfirmationEvent[field];

    const result = NewMessageConfirmationEventSchema.safeParse(
      newMessageConfirmationEvent,
    );

    expect(
      !result.success &&
        result.error.issues.length === 1 &&
        result.error.issues[0].path.length === 1 &&
        result.error.issues[0].path[0] === field,
    ).toBe(true);
  });
});
