import { outgoingTokenEventBuilder } from '@/routes/cache-hooks/entities/__tests__/outgoing-token.builder';
import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { OutgoingTokenEventSchema } from '@/routes/cache-hooks/entities/schemas/outgoing-token.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('OutgoingTokenEventSchema', () => {
  it('should validate an outgoing token event', () => {
    const outgoingTokenEvent = outgoingTokenEventBuilder().build();

    const result = OutgoingTokenEventSchema.safeParse(outgoingTokenEvent);

    expect(result.success).toBe(true);
  });

  it('should not allow a non-OUTGOING_TOKEN event', () => {
    const outgoingTokenEvent = outgoingTokenEventBuilder()
      .with('type', faker.word.sample() as EventType.OUTGOING_TOKEN)
      .build();

    const result = OutgoingTokenEventSchema.safeParse(outgoingTokenEvent);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          received: outgoingTokenEvent.type,
          code: 'invalid_literal',
          expected: 'OUTGOING_TOKEN',
          path: ['type'],
          message: 'Invalid literal value, expected "OUTGOING_TOKEN"',
        },
      ]),
    );
  });

  it.each(['address' as const, 'tokenAddress' as const])(
    'should not allow a non-address %s',
    (field) => {
      const outgoingTokenEvent = outgoingTokenEventBuilder()
        .with(field, faker.string.alpha() as `0x${string}`)
        .build();

      const result = OutgoingTokenEventSchema.safeParse(outgoingTokenEvent);

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
      const outgoingTokenEvent = outgoingTokenEventBuilder()
        .with(field, nonChecksummedAddress)
        .build();

      const result = OutgoingTokenEventSchema.safeParse(outgoingTokenEvent);

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
    const outgoingTokenEvent = outgoingTokenEventBuilder().build();
    delete outgoingTokenEvent[field];

    const result = OutgoingTokenEventSchema.safeParse(outgoingTokenEvent);

    expect(
      !result.success &&
        result.error.issues.length === 1 &&
        result.error.issues[0].path.length === 1 &&
        result.error.issues[0].path[0] === field,
    ).toBe(true);
  });
});
