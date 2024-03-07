import { ChainUpdateEventSchema } from '@/routes/cache-hooks/entities/schemas/chain-update.schema';
import { faker } from '@faker-js/faker';
import { ZodError } from 'zod';

describe('ChainUpdateEventSchema', () => {
  it('should validate a valid chain event', () => {
    const chainEvent = {
      type: 'CHAIN_UPDATE',
      chainId: faker.string.numeric(),
    };

    const result = ChainUpdateEventSchema.safeParse(chainEvent);

    expect(result.success).toBe(true);
  });

  it('should not allow an invalid chain event', () => {
    const invalidChainEvent = {
      invalid: 'chainEvent',
    };

    const result = ChainUpdateEventSchema.safeParse(invalidChainEvent);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        // @ts-expect-error - no type inferral for literal
        {
          code: 'invalid_literal',
          expected: 'CHAIN_UPDATE',
          path: ['type'],
          message: 'Invalid literal value, expected "CHAIN_UPDATE"',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['chainId'],
          message: 'Required',
        },
      ]),
    );
  });
});
