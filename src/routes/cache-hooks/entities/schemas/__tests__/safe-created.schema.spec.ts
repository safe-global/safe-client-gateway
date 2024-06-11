import { safeCreatedEventBuilder } from '@/routes/cache-hooks/entities/__tests__/safe-created.build';
import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { SafeCreatedEventSchema } from '@/routes/cache-hooks/entities/schemas/safe-created.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('SafeCreatedEventSchema', () => {
  it('should validate an SafeCreated event', () => {
    const safeCreatedEvent = safeCreatedEventBuilder().build();

    const result = SafeCreatedEventSchema.safeParse(safeCreatedEvent);

    expect(result.success).toBe(true);
  });

  it('should checksum the address', () => {
    const nonChecksummedAddress = faker.finance.ethereumAddress().toLowerCase();
    const safeCreatedEvent = safeCreatedEventBuilder()
      .with('address', nonChecksummedAddress as `0x${string}`)
      .build();

    const result = SafeCreatedEventSchema.safeParse(safeCreatedEvent);

    expect(result.success && result.data.address).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should not allow a non-SAFE_CREATED event', () => {
    const safeCreatedEvent = safeCreatedEventBuilder()
      .with('type', faker.word.sample() as EventType.SAFE_CREATED)
      .build();

    const result = SafeCreatedEventSchema.safeParse(safeCreatedEvent);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          received: safeCreatedEvent.type,
          code: 'invalid_literal',
          expected: 'SAFE_CREATED',
          path: ['type'],
          message: 'Invalid literal value, expected "SAFE_CREATED"',
        },
      ]),
    );
  });

  it('should not allow a missing chainId', () => {
    const safeCreatedEvent = safeCreatedEventBuilder().build();
    // @ts-expect-error - inferred types don't allow optional fields
    delete safeCreatedEvent.chainId;

    const result = SafeCreatedEventSchema.safeParse(safeCreatedEvent);

    expect(
      !result.success &&
        result.error.issues.length === 1 &&
        result.error.issues[0].path.length === 1 &&
        result.error.issues[0].path[0] === 'chainId',
    ).toBe(true);
  });
});
