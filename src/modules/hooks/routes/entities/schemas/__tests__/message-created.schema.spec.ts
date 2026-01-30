import { messageCreatedEventBuilder } from '@/modules/hooks/routes/entities/__tests__/message-created.builder';
import type { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import { MessageCreatedEventSchema } from '@/modules/hooks/routes/entities/schemas/message-created.schema';
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';

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

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_value',
        path: ['type'],
        message: 'Invalid input: expected "MESSAGE_CREATED"',
        values: ['MESSAGE_CREATED'],
      },
    ]);
  });

  it('should not allow a non-address address', () => {
    const messageCreatedEvent = messageCreatedEventBuilder()
      .with('address', faker.string.alpha() as Address)
      .build();

    const result = MessageCreatedEventSchema.safeParse(messageCreatedEvent);

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
