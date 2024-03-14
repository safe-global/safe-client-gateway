import { outgoingEtherEventBuilder } from '@/routes/cache-hooks/entities/__tests__/outgoing-ether.builder';
import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { OutgoingEtherEventSchema } from '@/routes/cache-hooks/entities/schemas/outgoing-ether.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('OutgoingEtherEventSchema', () => {
  it('should validate an outgoing Ether event', () => {
    const outgoingEtherEvent = outgoingEtherEventBuilder().build();

    const result = OutgoingEtherEventSchema.safeParse(outgoingEtherEvent);

    expect(result.success).toBe(true);
  });

  it('should not allow a non-OUTGOING_ETHER event', () => {
    const outgoingEtherEvent = outgoingEtherEventBuilder()
      .with('type', faker.word.sample() as EventType.OUTGOING_ETHER)
      .build();

    const result = OutgoingEtherEventSchema.safeParse(outgoingEtherEvent);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          received: outgoingEtherEvent.type,
          code: 'invalid_literal',
          expected: 'OUTGOING_ETHER',
          path: ['type'],
          message: 'Invalid literal value, expected "OUTGOING_ETHER"',
        },
      ]),
    );
  });

  it('should not allow a non-address address', () => {
    const outgoingEtherEvent = outgoingEtherEventBuilder()
      .with('address', faker.string.alpha() as `0x${string}`)
      .build();

    const result = OutgoingEtherEventSchema.safeParse(outgoingEtherEvent);

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
    const outgoingEtherEvent = outgoingEtherEventBuilder()
      .with('address', nonChecksummedAddress)
      .build();

    const result = OutgoingEtherEventSchema.safeParse(outgoingEtherEvent);

    expect(result.success && result.data.address).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it.each([
    ['type' as const],
    ['address' as const],
    ['chainId' as const],
    ['txHash' as const],
    ['value' as const],
  ])('should not allow a missing %s', (field) => {
    const outgoingEtherEvent = outgoingEtherEventBuilder().build();
    delete outgoingEtherEvent[field];

    const result = OutgoingEtherEventSchema.safeParse(outgoingEtherEvent);

    expect(
      !result.success &&
        result.error.issues.length === 1 &&
        result.error.issues[0].path.length === 1 &&
        result.error.issues[0].path[0] === field,
    ).toBe(true);
  });
});
