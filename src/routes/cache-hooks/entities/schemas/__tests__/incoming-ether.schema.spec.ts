import { incomingEtherEventBuilder } from '@/routes/cache-hooks/entities/__tests__/incoming-ether.builder';
import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { IncomingEtherEventSchema } from '@/routes/cache-hooks/entities/schemas/incoming-ether.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('IncomingEtherEventSchema', () => {
  it('should validate an incoming Ether event', () => {
    const incomingEtherEvent = incomingEtherEventBuilder().build();

    const result = IncomingEtherEventSchema.safeParse(incomingEtherEvent);

    expect(result.success).toBe(true);
  });

  it('should not allow a non-INCOMING_ETHER event', () => {
    const incomingEtherEvent = incomingEtherEventBuilder()
      .with('type', faker.word.sample() as EventType.INCOMING_ETHER)
      .build();

    const result = IncomingEtherEventSchema.safeParse(incomingEtherEvent);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          received: incomingEtherEvent.type,
          code: 'invalid_literal',
          expected: 'INCOMING_ETHER',
          path: ['type'],
          message: 'Invalid literal value, expected "INCOMING_ETHER"',
        },
      ]),
    );
  });

  it('should not allow a non-address address', () => {
    const incomingEtherEvent = incomingEtherEventBuilder()
      .with('address', faker.string.alpha() as `0x${string}`)
      .build();

    const result = IncomingEtherEventSchema.safeParse(incomingEtherEvent);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'custom',
          path: ['address'],
          message: 'Invalid input',
        },
      ]),
    );
  });

  it('should checksum the address', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as `0x${string}`;
    const incomingEtherEvent = incomingEtherEventBuilder()
      .with('address', nonChecksummedAddress)
      .build();

    const result = IncomingEtherEventSchema.safeParse(incomingEtherEvent);

    expect(result.success && result.data.address).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it.each([
    'type' as const,
    'address' as const,
    'chainId' as const,
    'txHash' as const,
    'value' as const,
  ])('should not allow a missing %s', (field) => {
    const incomingEtherEvent = incomingEtherEventBuilder().build();
    delete incomingEtherEvent[field];

    const result = IncomingEtherEventSchema.safeParse(incomingEtherEvent);

    expect(
      !result.success &&
        result.error.issues.length === 1 &&
        result.error.issues[0].path.length === 1 &&
        result.error.issues[0].path[0] === field,
    ).toBe(true);
  });
});
