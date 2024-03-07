import { OutgoingEtherEventSchema } from '@/routes/cache-hooks/entities/schemas/outgoing-ether.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('OutgoingEtherEventSchema', () => {
  const outgoingEtherEvent = {
    type: 'OUTGOING_ETHER',
    address: faker.finance.ethereumAddress(),
    chainId: faker.string.numeric(),
    txHash: faker.string.hexadecimal(),
    value: faker.string.numeric(),
  };

  it('should validate an outgoing Ether event', () => {
    const result = OutgoingEtherEventSchema.safeParse(outgoingEtherEvent);

    expect(result.success).toBe(true);
  });

  it('should checksum the address', () => {
    const result = OutgoingEtherEventSchema.safeParse(outgoingEtherEvent);

    expect(result.success && result.data.address).toBe(
      getAddress(outgoingEtherEvent.address),
    );
  });

  it('should not allow an invalid outgoing Ether event', () => {
    const invalidOutgoingEtherEvent = {
      invalid: 'outgoingEtherEvent',
    };

    const result = OutgoingEtherEventSchema.safeParse(
      invalidOutgoingEtherEvent,
    );

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        // @ts-expect-error - no type inferral for literal
        {
          code: 'invalid_literal',
          expected: 'OUTGOING_ETHER',
          path: ['type'],
          message: 'Invalid literal value, expected "OUTGOING_ETHER"',
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
