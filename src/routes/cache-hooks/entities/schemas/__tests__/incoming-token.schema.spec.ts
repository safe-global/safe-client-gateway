import { incomingTokenEventBuilder } from '@/routes/cache-hooks/entities/__tests__/incoming-token.builder';
import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { IncomingTokenEventSchema } from '@/routes/cache-hooks/entities/schemas/incoming-token.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('IncomingTokenEventSchema', () => {
  it('should validate an incoming token event', () => {
    const incomingTokenEvent = incomingTokenEventBuilder().build();

    const result = IncomingTokenEventSchema.safeParse(incomingTokenEvent);

    expect(result.success).toBe(true);
  });

  it('should not allow a non-INCOMING_TOKEN event', () => {
    const incomingTokenEvent = incomingTokenEventBuilder()
      .with('type', faker.word.sample() as EventType.INCOMING_TOKEN)
      .build();

    const result = IncomingTokenEventSchema.safeParse(incomingTokenEvent);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          received: incomingTokenEvent.type,
          code: 'invalid_literal',
          expected: 'INCOMING_TOKEN',
          path: ['type'],
          message: 'Invalid literal value, expected "INCOMING_TOKEN"',
        },
      ]),
    );
  });

  it.each(['address' as const, 'tokenAddress' as const])(
    'should not allow a non-address %s',
    (field) => {
      const incomingTokenEvent = incomingTokenEventBuilder()
        .with(field, faker.string.alpha() as `0x${string}`)
        .build();

      const result = IncomingTokenEventSchema.safeParse(incomingTokenEvent);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'custom',
            message: 'Invalid address',
            path: [field],
          },
        ]),
      );
    },
  );

  it.each(['address' as const, 'tokenAddress' as const])(
    'should checksum the %s',
    (field) => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase() as `0x${string}`;
      const incomingTokenEvent = incomingTokenEventBuilder()
        .with(field, nonChecksummedAddress)
        .build();

      const result = IncomingTokenEventSchema.safeParse(incomingTokenEvent);

      expect(result.success && result.data[field]).toBe(
        getAddress(nonChecksummedAddress),
      );
    },
  );

  it.each([
    'type' as const,
    'address' as const,
    'chainId' as const,
    'tokenAddress' as const,
    'txHash' as const,
  ])(`should not allow a missing %s`, (field) => {
    const incomingTokenEvent = incomingTokenEventBuilder().build();
    delete incomingTokenEvent[field];

    const result = IncomingTokenEventSchema.safeParse(incomingTokenEvent);

    expect(
      !result.success &&
        result.error.issues.length === 1 &&
        result.error.issues[0].path.length === 1 &&
        result.error.issues[0].path[0] === field,
    ).toBe(true);
  });
});
