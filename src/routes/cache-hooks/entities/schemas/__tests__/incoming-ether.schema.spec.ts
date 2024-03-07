import { IncomingEtherEventSchema } from '@/routes/cache-hooks/entities/schemas/incoming-ether.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('IncomingEtherEventSchema', () => {
  const incomingEtherEvent = {
    type: 'INCOMING_ETHER',
    address: faker.finance.ethereumAddress(),
    chainId: faker.string.numeric(),
    txHash: faker.string.hexadecimal(),
    value: faker.string.numeric(),
  };

  it('should validate an incoming Ether event', () => {
    const result = IncomingEtherEventSchema.safeParse(incomingEtherEvent);

    expect(result.success).toBe(true);
  });

  it('should checksum the address', () => {
    const result = IncomingEtherEventSchema.safeParse(incomingEtherEvent);

    expect(result.success && result.data.address).toBe(
      getAddress(incomingEtherEvent.address),
    );
  });

  it('should not allow an invalid incoming Ether event', () => {
    const invalidIncomingEtherEvent = {
      invalid: 'incomingEtherEvent',
    };

    const result = IncomingEtherEventSchema.safeParse(
      invalidIncomingEtherEvent,
    );

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        // @ts-expect-error - no type inferral for literal
        {
          code: 'invalid_literal',
          expected: 'INCOMING_ETHER',
          path: ['type'],
          message: 'Invalid literal value, expected "INCOMING_ETHER"',
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
          path: ['txHash'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['value'],
          message: 'Required',
        },
      ]),
    );
  });
});
