import { ModuleTransactionEventSchema } from '@/routes/cache-hooks/entities/schemas/module-transaction.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('ModuleTransactionEventSchema', () => {
  const moduleTransactionEvent = {
    type: 'MODULE_TRANSACTION',
    address: faker.finance.ethereumAddress(),
    chainId: faker.string.numeric(),
    module: faker.finance.ethereumAddress(),
    txHash: faker.string.hexadecimal(),
  };

  it('should validate a module transaction event', () => {
    const result = ModuleTransactionEventSchema.safeParse(
      moduleTransactionEvent,
    );

    expect(result.success).toBe(true);
  });

  it('should checksum the address and module', () => {
    const result = ModuleTransactionEventSchema.safeParse(
      moduleTransactionEvent,
    );

    expect(result.success && result.data.address).toBe(
      getAddress(moduleTransactionEvent.address),
    );
    expect(result.success && result.data.module).toBe(
      getAddress(moduleTransactionEvent.module),
    );
  });

  it('should not allow an invalid module transaction event', () => {
    const invalidModuleTransactionEvent = {
      invalid: 'moduleTransactionEvent',
    };

    const result = ModuleTransactionEventSchema.safeParse(
      invalidModuleTransactionEvent,
    );

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        // @ts-expect-error - no type inferral for literal
        {
          code: 'invalid_literal',
          expected: 'MODULE_TRANSACTION',
          path: ['type'],
          message: 'Invalid literal value, expected "MODULE_TRANSACTION"',
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
          path: ['module'],
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
