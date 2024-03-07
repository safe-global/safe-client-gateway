import { NewMessageConfirmationEventSchema } from '@/routes/cache-hooks/entities/schemas/new-message-confirmation.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('NewMessageConfirmationEventSchema', () => {
  const newMessageConfirmationEvent = {
    type: 'MESSAGE_CONFIRMATION',
    address: faker.finance.ethereumAddress(),
    chainId: faker.string.numeric(),
    messageHash: faker.string.hexadecimal(),
  };

  it('should validate a message confirmation event', () => {
    const result = NewMessageConfirmationEventSchema.safeParse(
      newMessageConfirmationEvent,
    );

    expect(result.success).toBe(true);
  });

  it('should checksum the address', () => {
    const result = NewMessageConfirmationEventSchema.safeParse(
      newMessageConfirmationEvent,
    );

    expect(result.success && result.data.address).toBe(
      getAddress(newMessageConfirmationEvent.address),
    );
  });

  it('should not allow an invalid message event', () => {
    const invalidNewMessageConfirmationEvent = {
      invalid: 'newMessageConfirmationEvent',
    };

    const result = NewMessageConfirmationEventSchema.safeParse(
      invalidNewMessageConfirmationEvent,
    );

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        // @ts-expect-error - no type inferral for literal
        {
          code: 'invalid_literal',
          expected: 'MESSAGE_CONFIRMATION',
          path: ['type'],
          message: 'Invalid literal value, expected "MESSAGE_CONFIRMATION"',
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
