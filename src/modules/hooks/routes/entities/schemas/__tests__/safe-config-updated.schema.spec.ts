// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';
import { safeConfigUpdatedEventBuilder } from '#/modules/hooks/routes/entities/__tests__/safe-config-updated.builder';
import type { TransactionEventType } from '#/modules/hooks/routes/entities/event-type.entity';
import { SafeConfigUpdatedEventSchema } from '#/modules/hooks/routes/entities/schemas/safe-config-updated.schema';

describe('SafeConfigUpdatedEventSchema', () => {
  it('should validate a Safe config updated event', () => {
    const safeConfigUpdatedEvent = safeConfigUpdatedEventBuilder().build();

    const result = SafeConfigUpdatedEventSchema.safeParse(
      safeConfigUpdatedEvent,
    );

    expect(result.success).toBe(true);
  });

  it('should not allow a non-SAFE_CONFIG_UPDATED event', () => {
    const safeConfigUpdatedEvent = safeConfigUpdatedEventBuilder()
      .with(
        'type',
        faker.word.sample() as TransactionEventType.SAFE_CONFIG_UPDATED,
      )
      .build();

    const result = SafeConfigUpdatedEventSchema.safeParse(
      safeConfigUpdatedEvent,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_value',
        values: ['SAFE_CONFIG_UPDATED'],
        path: ['type'],
        message: 'Invalid input: expected "SAFE_CONFIG_UPDATED"',
      },
    ]);
  });

  it('should not allow a non-address address', () => {
    const safeConfigUpdatedEvent = safeConfigUpdatedEventBuilder()
      .with('address', faker.string.alpha() as Address)
      .build();

    const result = SafeConfigUpdatedEventSchema.safeParse(
      safeConfigUpdatedEvent,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid address',
        path: ['address'],
      },
    ]);
  });

  it('should checksum the address', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as Address;
    const safeConfigUpdatedEvent = safeConfigUpdatedEventBuilder()
      .with('address', nonChecksummedAddress)
      .build();

    const result = SafeConfigUpdatedEventSchema.safeParse(
      safeConfigUpdatedEvent,
    );

    expect(result.success && result.data.address).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it.each([
    'type' as const,
    'address' as const,
    'chainId' as const,
    'txHash' as const,
  ])('should not allow a missing %s', (field) => {
    const safeConfigUpdatedEvent = safeConfigUpdatedEventBuilder().build();
    delete safeConfigUpdatedEvent[field];

    const result = SafeConfigUpdatedEventSchema.safeParse(
      safeConfigUpdatedEvent,
    );

    expect(
      !result.success &&
        result.error.issues.length === 1 &&
        result.error.issues[0].path.length === 1 &&
        result.error.issues[0].path[0] === field,
    ).toBe(true);
  });
});
