import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';
import { typedDataBuilder } from '@/modules/messages/routes/entities/__tests__/typed-data.builder';
import { messageBuilder } from '@/modules/messages/domain/entities/__tests__/message.builder';
import { MessageSchema } from '@/modules/messages/domain/entities/message.entity';
import type { Message } from '@/modules/messages/domain/entities/message.entity';

describe('MessageSchema', () => {
  it('should validate a Message', () => {
    const message = messageBuilder().build();

    const result = MessageSchema.safeParse(message);

    expect(result.success).toBe(true);
  });

  it.each([
    'created' as const,
    'modified' as const,
    'safe' as const,
    'messageHash' as const,
    'message' as const,
    'proposedBy' as const,
    'confirmations' as const,
  ])('should fail when %s is missing', (key) => {
    const message = messageBuilder().build();
    delete message[key];

    const result = MessageSchema.safeParse(message);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(!result.success && result.error.issues[0].path).toStrictEqual([key]);
  });

  it.each(['created' as const, 'modified' as const])(
    'should coerce %s to a Date',
    (key) => {
      const date = faker.date.recent();
      const message = messageBuilder()
        .with(key, date.toString() as unknown as Date)
        .build();

      const result = MessageSchema.safeParse(message);

      // Zod coerces the date to the nearest millisecond
      date.setMilliseconds(0);
      expect(result.success && result.data[key]).toStrictEqual(date);
    },
  );

  it.each(['safe' as const, 'proposedBy' as const])(
    'should checksum the %s address',
    (key) => {
      const nonChecksummedAddress = faker.finance.ethereumAddress().toString();
      const message = messageBuilder()
        .with(key, nonChecksummedAddress as Address)
        .build();

      const result = MessageSchema.safeParse(message);

      expect(result.success && result.data[key]).toBe(
        getAddress(nonChecksummedAddress),
      );
    },
  );

  it.each(['messageHash' as const, 'preparedSignature' as const])(
    'should not allow a non-hex messageHash',
    (key) => {
      const message = messageBuilder()
        .with(key, faker.string.alphanumeric() as Address)
        .build();

      const result = MessageSchema.safeParse(message);

      expect(!result.success && result.error.issues.length).toBe(1);
      expect(!result.success && result.error.issues[0]).toStrictEqual({
        code: 'custom',
        message: 'Invalid "0x" notated hex string',
        path: [key],
      });
    },
  );

  it.each([
    ['string', faker.string.alphanumeric()],
    ['typed data', typedDataBuilder().build()],
  ])('should accept a %s message', (_, message) => {
    const result = MessageSchema.safeParse(
      messageBuilder().with('message', message).build(),
    );

    expect(result.success && result.data.message).toStrictEqual(message);
  });

  it.each([
    'safeAppId' as const,
    'preparedSignature' as const,
    'origin' as const,
  ])('should default %s to null', (key) => {
    const message = messageBuilder().build();
    delete message[key];

    const result = MessageSchema.safeParse(message);

    expect(result.success && result.data[key]).toBe(null);
  });

  it('should not allow a non-array confirmations', () => {
    const message = messageBuilder()
      .with(
        'confirmations',
        faker.string.numeric() as unknown as Message['confirmations'],
      )
      .build();

    const result = MessageSchema.safeParse(message);

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid_type',
        expected: 'array',
        path: ['confirmations'],
      }),
    ]);
  });

  it('should not validate an invalid Message', () => {
    const message = {
      invalid: 'message',
    };

    const result = MessageSchema.safeParse(message);

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid_type',
        expected: 'date',
        path: ['created'],
      }),
      expect.objectContaining({
        code: 'invalid_type',
        expected: 'date',
        path: ['modified'],
      }),
      expect.objectContaining({
        code: 'invalid_type',
        expected: 'string',
        path: ['safe'],
      }),
      expect.objectContaining({
        code: 'invalid_type',
        expected: 'string',
        path: ['messageHash'],
      }),
      expect.objectContaining({
        code: 'invalid_union',
        message: 'Invalid input',
        path: ['message'],
        errors: [
          [
            expect.objectContaining({
              code: 'invalid_type',
              expected: 'string',
              path: [],
            }),
          ],
          [
            expect.objectContaining({
              code: 'invalid_type',
              expected: 'object',
              path: [],
            }),
          ],
        ],
      }),
      expect.objectContaining({
        code: 'invalid_type',
        expected: 'string',
        path: ['proposedBy'],
      }),
      expect.objectContaining({
        code: 'invalid_type',
        expected: 'array',
        path: ['confirmations'],
      }),
    ]);
  });
});
