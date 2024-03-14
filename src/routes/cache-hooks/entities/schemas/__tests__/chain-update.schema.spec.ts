import { chainUpdateEventBuilder } from '@/routes/cache-hooks/entities/__tests__/chain-update.builder';
import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { ChainUpdateEventSchema } from '@/routes/cache-hooks/entities/schemas/chain-update.schema';
import { faker } from '@faker-js/faker';
import { ZodError } from 'zod';

describe('ChainUpdateEventSchema', () => {
  it('should validate a valid chain event', () => {
    const chainUpdateEvent = chainUpdateEventBuilder().build();

    const result = ChainUpdateEventSchema.safeParse(chainUpdateEvent);

    expect(result.success).toBe(true);
  });

  it('should not allow an non-CHAIN_UPDATE event', () => {
    const chainUpdateEvent = chainUpdateEventBuilder()
      .with('type', faker.word.sample() as EventType.CHAIN_UPDATE)
      .build();

    const result = ChainUpdateEventSchema.safeParse(chainUpdateEvent);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          received: chainUpdateEvent.type,
          code: 'invalid_literal',
          expected: 'CHAIN_UPDATE',
          path: ['type'],
          message: 'Invalid literal value, expected "CHAIN_UPDATE"',
        },
      ]),
    );
  });

  it.each([['type' as const], ['chainId' as const]])(
    'should not allow a missing %s',
    (field) => {
      const chainUpdateEvent = chainUpdateEventBuilder().build();
      delete chainUpdateEvent[field];

      const result = ChainUpdateEventSchema.safeParse(chainUpdateEvent);

      expect(
        !result.success &&
          result.error.issues.length === 1 &&
          result.error.issues[0].path.length === 1 &&
          result.error.issues[0].path[0] === field,
      ).toBe(true);
    },
  );
});
