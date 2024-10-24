import { ZodError } from 'zod';
import { faker } from '@faker-js/faker';
import { reorgDetectedEventBuilder } from '@/routes/hooks/entities/__tests__/reorg-detected.builder';
import { ReorgDetectedEventSchema } from '@/routes/hooks/entities/schemas/reorg-detected.schema';
import type { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';

describe('ReorgDetectedEventSchema', () => {
  it('should validate a reorg detected event', () => {
    const reorgDetectedEvent = reorgDetectedEventBuilder().build();

    const result = ReorgDetectedEventSchema.safeParse(reorgDetectedEvent);

    expect(result.success).toBe(true);
  });

  it('should not allow a non-REORG_DETECTED event', () => {
    const executedTransactionEvent = reorgDetectedEventBuilder()
      .with('type', faker.word.sample() as TransactionEventType.REORG_DETECTED)
      .build();

    const result = ReorgDetectedEventSchema.safeParse(executedTransactionEvent);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          received: executedTransactionEvent.type,
          code: 'invalid_literal',
          expected: 'REORG_DETECTED',
          path: ['type'],
          message: 'Invalid literal value, expected "REORG_DETECTED"',
        },
      ]),
    );
  });

  it('should not allow a non-numeric chainId', () => {
    const reorgDetectedEvent = reorgDetectedEventBuilder()
      .with('chainId', faker.string.alpha())
      .build();

    const result = ReorgDetectedEventSchema.safeParse(reorgDetectedEvent);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'custom',
          message: 'Invalid base-10 numeric string',
          path: ['chainId'],
        },
      ]),
    );
  });

  it('should not allow a non-int blockNumber', () => {
    const reorgDetectedEvent = reorgDetectedEventBuilder()
      .with('blockNumber', faker.number.float())
      .build();

    const result = ReorgDetectedEventSchema.safeParse(reorgDetectedEvent);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'integer',
          received: 'float',
          message: 'Expected integer, received float',
          path: ['blockNumber'],
        },
      ]),
    );
  });

  it.each(['type' as const, 'chainId' as const, 'blockNumber' as const])(
    'should not allow an undefined %s',
    (key) => {
      const reorgDetectedEvent = reorgDetectedEventBuilder().build();
      delete reorgDetectedEvent[key];

      const result = ReorgDetectedEventSchema.safeParse(reorgDetectedEvent);

      expect(!result.success && result.error.issues.length).toBe(1);
      expect(!result.success && result.error.issues[0].path).toStrictEqual([
        key,
      ]);
    },
  );
});
