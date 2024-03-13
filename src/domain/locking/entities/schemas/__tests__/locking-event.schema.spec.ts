import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import {
  lockEventItemBuilder,
  unlockEventItemBuilder,
  withdrawEventItemBuilder,
} from '@/domain/locking/entities/__tests__/locking-event.builder';
import {
  LockEventItemSchema,
  LockingEventPageSchema,
  LockingEventSchema,
  UnlockEventItemSchema,
  WithdrawEventItemSchema,
} from '@/domain/locking/entities/schemas/locking-event.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('Locking event schemas', () => {
  describe('LockingEventItemSchema', () => {
    it('should validate a valid LockEventItem', () => {
      const lockEventItem = lockEventItemBuilder().build();

      const result = LockEventItemSchema.safeParse(lockEventItem);

      expect(result.success).toBe(true);
    });

    it('should checksum the holder', () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase() as `0x${string}`;
      const lockEventItem = lockEventItemBuilder()
        .with('holder', nonChecksummedAddress)
        .build();

      const result = LockEventItemSchema.safeParse(lockEventItem);

      expect(result.success && result.data.holder).toBe(
        getAddress(nonChecksummedAddress),
      );
    });

    it('should not validate an invalid LockEventItem', () => {
      const lockEventItem = { invalid: 'lockEventItem' };

      const result = LockEventItemSchema.safeParse(lockEventItem);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_date',
            path: ['executionDate'],
            message: 'Invalid date',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['transactionHash'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['holder'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['amount'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['logIndex'],
            message: 'Required',
          },
          // @ts-expect-error - zod can't infer enum
          {
            code: 'invalid_literal',
            expected: 'LOCKED',
            path: ['eventType'],
            message: 'Invalid literal value, expected "LOCKED"',
          },
        ]),
      );
    });
  });

  describe('UnlockEventItemSchema', () => {
    it('should validate a valid UnlockEventItem', () => {
      const unlockEventItem = unlockEventItemBuilder().build();

      const result = UnlockEventItemSchema.safeParse(unlockEventItem);

      expect(result.success).toBe(true);
    });

    it('should checksum the holder', () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase() as `0x${string}`;
      const unlockEventItem = unlockEventItemBuilder()
        .with('holder', nonChecksummedAddress)
        .build();

      const result = UnlockEventItemSchema.safeParse(unlockEventItem);

      expect(result.success && result.data.holder).toBe(
        getAddress(nonChecksummedAddress),
      );
    });

    it('should not validate an invalid UnlockEventItem', () => {
      const unlockEventItem = { invalid: 'unlockEventItem' };

      const result = UnlockEventItemSchema.safeParse(unlockEventItem);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_date',
            path: ['executionDate'],
            message: 'Invalid date',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['transactionHash'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['holder'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['amount'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['logIndex'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['unlockIndex'],
            message: 'Required',
          },
          // @ts-expect-error - zod can't infer enum
          {
            code: 'invalid_literal',
            expected: 'UNLOCKED',
            path: ['eventType'],
            message: 'Invalid literal value, expected "UNLOCKED"',
          },
        ]),
      );
    });
  });

  describe('WithdrawEventItemSchema', () => {
    it('should validate a valid WithdrawEventItem', () => {
      const withdrawEventItem = withdrawEventItemBuilder().build();

      const result = WithdrawEventItemSchema.safeParse(withdrawEventItem);

      expect(result.success).toBe(true);
    });

    it('should checksum the holder', () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase() as `0x${string}`;
      const withdrawEventItem = withdrawEventItemBuilder()
        .with('holder', nonChecksummedAddress)
        .build();

      const result = WithdrawEventItemSchema.safeParse(withdrawEventItem);

      expect(result.success && result.data.holder).toBe(
        getAddress(nonChecksummedAddress),
      );
    });

    it('should not validate an invalid WithdrawEventItem', () => {
      const withdrawEventItem = { invalid: 'withdrawEventItem' };

      const result = WithdrawEventItemSchema.safeParse(withdrawEventItem);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_date',
            path: ['executionDate'],
            message: 'Invalid date',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['transactionHash'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['holder'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['amount'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['logIndex'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['unlockIndex'],
            message: 'Required',
          },
          // @ts-expect-error - zod can't infer enum
          {
            code: 'invalid_literal',
            expected: 'WITHDRAWN',
            path: ['eventType'],
            message: 'Invalid literal value, expected "WITHDRAWN"',
          },
        ]),
      );
    });
  });

  describe('LockingEventSchema', () => {
    it('should validate a valid locking event', () => {
      const lockingEvent = faker.helpers.arrayElement([
        lockEventItemBuilder().build(),
        unlockEventItemBuilder().build(),
        withdrawEventItemBuilder().build(),
      ]);

      const result = LockingEventSchema.safeParse(lockingEvent);

      expect(result.success).toBe(true);
    });

    it('should not validate an invalid locking event', () => {
      const lockingEvent = { invalid: 'lockingEvent' };

      const result = LockingEventSchema.safeParse(lockingEvent);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_union_discriminator',
            options: ['LOCKED', 'UNLOCKED', 'WITHDRAWN'],
            path: ['eventType'],
            message:
              "Invalid discriminator value. Expected 'LOCKED' | 'UNLOCKED' | 'WITHDRAWN'",
          },
        ]),
      );
    });
  });

  describe('LockingEventPageSchema', () => {
    it('should validate a valid locking event page', () => {
      const lockingEvent = faker.helpers.arrayElement([
        lockEventItemBuilder().build(),
        unlockEventItemBuilder().build(),
        withdrawEventItemBuilder().build(),
      ]);
      const lockingEventPage = pageBuilder()
        .with('results', [lockingEvent])
        .with('count', 1)
        .with('previous', null)
        .with('next', null)
        .build();

      const result = LockingEventPageSchema.safeParse(lockingEventPage);

      expect(result.success).toBe(true);
    });

    it('should not validate an invalid locking event page', () => {
      const lockingEventPage = { invalid: 'lockingEventPage' };

      const result = LockingEventPageSchema.safeParse(lockingEventPage);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'number',
            received: 'undefined',
            path: ['count'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['next'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['previous'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'array',
            received: 'undefined',
            path: ['results'],
            message: 'Required',
          },
        ]),
      );
    });
  });
});
