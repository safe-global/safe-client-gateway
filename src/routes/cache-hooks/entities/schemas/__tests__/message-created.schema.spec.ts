import { MessageCreatedEventSchema } from '@/routes/cache-hooks/entities/schemas/message-created.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('MessageCreatedEventSchema', () => {
  const messageCreatedEvent = {
    type: 'MESSAGE_CREATED',
    address: faker.finance.ethereumAddress(),
    chainId: faker.string.numeric(),
    messageHash: faker.string.hexadecimal(),
  };

  it('should validate a message created event', () => {
    const result = MessageCreatedEventSchema.safeParse(messageCreatedEvent);

    expect(result.success).toBe(true);
  });

  it('should checksum the address', () => {
    const result = MessageCreatedEventSchema.safeParse(messageCreatedEvent);

    expect(result.success && result.data.address).toBe(
      getAddress(messageCreatedEvent.address),
    );
  });

  it('should not allow an invalid message event', () => {
    const invalidMessageCreatedEvent = {
      invalid: 'messageCreatedEvent',
    };

    const result = MessageCreatedEventSchema.safeParse(
      invalidMessageCreatedEvent,
    );

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        // @ts-expect-error - no type inferral for literal
        {
          code: 'invalid_literal',
          expected: 'MESSAGE_CREATED',
          path: ['type'],
          message: 'Invalid literal value, expected "MESSAGE_CREATED"',
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
          path: ['messageHash'],
          message: 'Required',
        },
      ]),
    );
  });
});
