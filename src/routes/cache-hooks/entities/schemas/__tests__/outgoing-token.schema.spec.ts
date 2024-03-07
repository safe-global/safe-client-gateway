import { OutgoingTokenEventSchema } from '@/routes/cache-hooks/entities/schemas/outgoing-token.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('OutgoingTokenEventSchema', () => {
  const outgoingTokenEvent = {
    type: 'OUTGOING_TOKEN',
    address: faker.finance.ethereumAddress(),
    chainId: faker.string.numeric(),
    tokenAddress: faker.finance.ethereumAddress(),
    txHash: faker.string.hexadecimal(),
  };

  it('should validate an outgoing token event', () => {
    const result = OutgoingTokenEventSchema.safeParse(outgoingTokenEvent);

    expect(result.success).toBe(true);
  });

  it('should checksum the address', () => {
    const result = OutgoingTokenEventSchema.safeParse(outgoingTokenEvent);

    expect(result.success && result.data.address).toBe(
      getAddress(outgoingTokenEvent.address),
    );
  });

  it('should not allow an invalid outgoing token event', () => {
    const invalidOutgoingTokenEvent = {
      invalid: 'outgoingTokenEvent',
    };

    const result = OutgoingTokenEventSchema.safeParse(
      invalidOutgoingTokenEvent,
    );

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        // @ts-expect-error - no type inferral for literal
        {
          code: 'invalid_literal',
          expected: 'OUTGOING_TOKEN',
          path: ['type'],
          message: 'Invalid literal value, expected "OUTGOING_TOKEN"',
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
