import { ModuleTransactionEventSchema } from '@/routes/cache-hooks/entities/schemas/module-transaction.schema';
import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';
import { moduleTransactionEventBuilder } from '@/routes/cache-hooks/entities/__tests__/module-transaction.builder';

describe('ModuleTransactionEventSchema', () => {
  it('should validate an module transaction event', () => {
    const moduleTransactionEvent = moduleTransactionEventBuilder().build();

    const result = ModuleTransactionEventSchema.safeParse(
      moduleTransactionEvent,
    );

    expect(result.success).toBe(true);
  });

  it('should not allow a non-MODULE_TRANSACTION event', () => {
    const moduleTransactionEvent = moduleTransactionEventBuilder()
      .with('type', faker.word.sample() as EventType.MODULE_TRANSACTION)
      .build();

    const result = ModuleTransactionEventSchema.safeParse(
      moduleTransactionEvent,
    );

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          received: moduleTransactionEvent.type,
          code: 'invalid_literal',
          expected: 'MODULE_TRANSACTION',
          path: ['type'],
          message: 'Invalid literal value, expected "MODULE_TRANSACTION"',
        },
      ]),
    );
  });

  it.each(['address' as const, 'module' as const])(
    'should not allow a non-address %s',
    (field) => {
      const moduleTransactionEvent = moduleTransactionEventBuilder()
        .with(field, faker.string.alpha() as `0x${string}`)
        .build();

      const result = ModuleTransactionEventSchema.safeParse(
        moduleTransactionEvent,
      );

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'custom',
            path: [field],
            message: 'Invalid input',
          },
        ]),
      );
    },
  );

  it.each(['address' as const, 'module' as const])(
    'should checksum the %s',
    (field) => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase() as `0x${string}`;
      const moduleTransactionEvent = moduleTransactionEventBuilder()
        .with(field, nonChecksummedAddress)
        .build();

      const result = ModuleTransactionEventSchema.safeParse(
        moduleTransactionEvent,
      );

      expect(result.success && result.data[field]).toBe(
        getAddress(nonChecksummedAddress),
      );
    },
  );

  it.each([
    'type' as const,
    'address' as const,
    'chainId' as const,
    'module' as const,
    'txHash' as const,
  ])(`should not allow a missing %s`, (field) => {
    const moduleTransactionEvent = moduleTransactionEventBuilder().build();
    delete moduleTransactionEvent[field];

    const result = ModuleTransactionEventSchema.safeParse(
      moduleTransactionEvent,
    );

    expect(
      !result.success &&
        result.error.issues.length === 1 &&
        result.error.issues[0].path.length === 1 &&
        result.error.issues[0].path[0] === field,
    ).toBe(true);
  });
});
