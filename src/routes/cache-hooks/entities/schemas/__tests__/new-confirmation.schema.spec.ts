import { NewConfirmationEventSchema } from '@/routes/cache-hooks/entities/schemas/new-confirmation.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('NewConfirmationEventSchema', () => {
  const newConfirmationEvent = {
    type: 'NEW_CONFIRMATION',
    address: faker.finance.ethereumAddress(),
    chainId: faker.string.numeric(),
    owner: faker.finance.ethereumAddress(),
    safeTxHash: faker.string.hexadecimal(),
  };

  it('should validate a new confrimation event', () => {
    const result = NewConfirmationEventSchema.safeParse(newConfirmationEvent);

    expect(result.success).toBe(true);
  });

  it('should checksum the address and owner', () => {
    const result = NewConfirmationEventSchema.safeParse(newConfirmationEvent);

    expect(result.success && result.data.address).toBe(
      getAddress(newConfirmationEvent.address),
    );
    expect(result.success && result.data.owner).toBe(
      getAddress(newConfirmationEvent.owner),
    );
  });

  it('should not allow an invalid new confirmation event', () => {
    const newConfirmationEvent = {
      invalid: 'newConfirmationEvent',
    };

    const result = NewConfirmationEventSchema.safeParse(newConfirmationEvent);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        // @ts-expect-error - no type inferral for literal
        {
          code: 'invalid_literal',
          expected: 'NEW_CONFIRMATION',
          path: ['type'],
          message: 'Invalid literal value, expected "NEW_CONFIRMATION"',
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
          path: ['owner'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['safeTxHash'],
          message: 'Required',
        },
      ]),
    );
  });
});
