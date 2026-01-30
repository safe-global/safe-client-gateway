import { outgoingEtherEventBuilder } from '@/modules/hooks/routes/entities/__tests__/outgoing-ether.builder';
import type { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import { OutgoingEtherEventSchema } from '@/modules/hooks/routes/entities/schemas/outgoing-ether.schema';
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';

describe('OutgoingEtherEventSchema', () => {
  it('should validate an outgoing Ether event', () => {
    const outgoingEtherEvent = outgoingEtherEventBuilder().build();

    const result = OutgoingEtherEventSchema.safeParse(outgoingEtherEvent);

    expect(result.success).toBe(true);
  });

  it('should not allow a non-OUTGOING_ETHER event', () => {
    const outgoingEtherEvent = outgoingEtherEventBuilder()
      .with('type', faker.word.sample() as TransactionEventType.OUTGOING_ETHER)
      .build();

    const result = OutgoingEtherEventSchema.safeParse(outgoingEtherEvent);

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid_value',
        values: ['OUTGOING_ETHER'],
        path: ['type'],
        message: 'Invalid input: expected "OUTGOING_ETHER"',
      }),
    ]);
  });

  it('should not allow a non-address address', () => {
    const outgoingEtherEvent = outgoingEtherEventBuilder()
      .with('address', faker.string.alpha() as Address)
      .build();

    const result = OutgoingEtherEventSchema.safeParse(outgoingEtherEvent);

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'custom',
        message: 'Invalid address',
        path: ['address'],
      }),
    ]);
  });

  it('should checksum the address', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as Address;
    const outgoingEtherEvent = outgoingEtherEventBuilder()
      .with('address', nonChecksummedAddress)
      .build();

    const result = OutgoingEtherEventSchema.safeParse(outgoingEtherEvent);

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
