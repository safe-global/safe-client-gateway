import { messageCreatedEventBuilder } from '@/routes/hooks/entities/__tests__/message-created.builder';
import { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import { MessageCreatedEventSchema } from '@/routes/hooks/entities/schemas/message-created.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('MessageCreatedEventSchema', () => {
  it('should validate a message created event', () => {
    const messageCreatedEvent = messageCreatedEventBuilder().build();

    const result = MessageCreatedEventSchema.safeParse(messageCreatedEvent);

    expect(result.success).toBe(true);
  });

  it('should not allow a non-MESSAGE_CREATED event', () => {
    const messageCreatedEvent = messageCreatedEventBuilder()
      .with('type', faker.word.sample() as TransactionEventType.MESSAGE_CREATED)
      .build();

    const result = MessageCreatedEventSchema.safeParse(messageCreatedEvent);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          received: messageCreatedEvent.type,
          code: 'invalid_literal',
          expected: 'MESSAGE_CREATED',
          path: ['type'],
          message: 'Invalid literal value, expected "MESSAGE_CREATED"',
        },
      ]),
    );
  });

  it('should not allow a non-address address', () => {
    const messageCreatedEvent = messageCreatedEventBuilder()
      .with('address', faker.string.alpha() as `0x${string}`)
      .build();

    const result = MessageCreatedEventSchema.safeParse(messageCreatedEvent);

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
    const messageCreatedEvent = messageCreatedEventBuilder()
      .with('address', nonChecksummedAddress)
      .build();

    const result = MessageCreatedEventSchema.safeParse(messageCreatedEvent);

    expect(result.success && result.data.address).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it.each([
    'type' as const,
    'address' as const,
    'chainId' as const,
    'messageHash' as const,
  ])(`should not allow a non-%s`, (field) => {
    const messageCreatedEvent = messageCreatedEventBuilder().build();
    delete messageCreatedEvent[field];

    const result = MessageCreatedEventSchema.safeParse(messageCreatedEvent);

    expect(
      !result.success &&
        result.error.issues.length === 1 &&
        result.error.issues[0].path.length === 1 &&
        result.error.issues[0].path[0] === field,
    ).toBe(true);
  });
});
