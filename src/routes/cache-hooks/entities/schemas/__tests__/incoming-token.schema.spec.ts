import { IncomingTokenEventSchema } from '@/routes/cache-hooks/entities/schemas/incoming-token.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('IncomingTokenEventSchema', () => {
  const incomingTokenEvent = {
    type: 'INCOMING_TOKEN',
    address: faker.finance.ethereumAddress(),
    chainId: faker.string.numeric(),
    tokenAddress: faker.finance.ethereumAddress(),
    txHash: faker.string.hexadecimal(),
  };

  it('should validate an incoming token event', () => {
    const result = IncomingTokenEventSchema.safeParse(incomingTokenEvent);

    expect(result.success).toBe(true);
  });

  it('should checksum the address', () => {
    const result = IncomingTokenEventSchema.safeParse(incomingTokenEvent);

    expect(result.success && result.data.address).toBe(
      getAddress(incomingTokenEvent.address),
    );
  });

  it('should not allow an invalid incoming token event', () => {
    const invalidIncomingTokenEvent = {
      invalid: 'incomingTokenEvent',
    };

    const result = IncomingTokenEventSchema.safeParse(
      invalidIncomingTokenEvent,
    );

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        // @ts-expect-error - no type inferral for literal
        {
          code: 'invalid_literal',
          expected: 'INCOMING_TOKEN',
          path: ['type'],
          message: 'Invalid literal value, expected "INCOMING_TOKEN"',
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
          path: ['tokenAddress'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['txHash'],
          message: 'Required',
        },
      ]),
    );
  });
});
