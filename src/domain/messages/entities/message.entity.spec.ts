import { fakeJson } from '@/__tests__/faker';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { messageBuilder } from '@/domain/messages/entities/__tests__/message.builder';
import {
  MessageSchema,
  MessagePageSchema,
} from '@/domain/messages/entities/message.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('Message entity schemas', () => {
  describe('MessageSchema', () => {
    it('should validate a valid Message', () => {
      const message = messageBuilder().build();

      const result = MessageSchema.safeParse(message);

      expect(result.success).toBe(true);
    });

    it.each(['created' as const, 'modified' as const])(
      'should coerce %s to a date',
      (key) => {
        const message = messageBuilder().build();

        const result = MessageSchema.safeParse(message);

        expect(result.success && result.data[key]).toStrictEqual(
          new Date(message[key]),
        );
      },
    );

    it.each(['safe' as const, 'proposedBy' as const])(
      'should checksum the %s',
      (key) => {
        const nonChecksummedAddress = faker.finance
          .ethereumAddress()
          .toLowerCase() as `0x${string}`;
        const message = messageBuilder()
          .with(key, nonChecksummedAddress)
          .build();

        const result = MessageSchema.safeParse(message);

        expect(result.success && result.data[key]).toBe(
          getAddress(nonChecksummedAddress),
        );
      },
    );

    it.each(['messageHash' as const, 'preparedSignature' as const])(
      'should not allow non-hex %s',
      (key) => {
        const message = messageBuilder()
          .with(key, faker.string.numeric() as `0x${string}`)
          .build();

        const result = MessageSchema.safeParse(message);

        expect(!result.success && result.error).toStrictEqual(
          new ZodError([
            {
              code: 'custom',
              message: 'Invalid "0x" notated hex string',
              path: [key],
            },
          ]),
        );
      },
    );

    it.each([
      ['string', faker.lorem.sentence()],
      ['object', JSON.parse(fakeJson())],
    ])('should allow a %s message', (_, message) => {
      const result = MessageSchema.safeParse({
        ...messageBuilder().build(),
        message,
      });

      expect(result.success).toBe(true);
    });

    it.each(['safeAppId' as const, 'preparedSignature' as const])(
      'should allow undefined %s, defaulting to null',
      (key) => {
        const message = messageBuilder().build();
        delete message[key];

        const result = MessageSchema.safeParse(message);

        expect(result.success && result.data[key]).toBe(null);
      },
    );

    it('should allow empty confirmations', () => {
      const message = messageBuilder().with('confirmations', []).build();

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
    ])('should not allow %s to be undefined', (key) => {
      const message = messageBuilder().build();
      delete message[key];

      const result = MessageSchema.safeParse(message);

      expect(
        !result.success &&
          result.error.issues.length === 1 &&
          result.error.issues[0].path.length === 1 &&
          result.error.issues[0].path[0] === key,
      ).toBe(true);
    });
  });

  describe('MessagePageSchema', () => {
    it('should validate a valid Page<Message>', () => {
      const message = messageBuilder().build();
      const messagePage = pageBuilder().with('results', [message]).build();

      const result = MessagePageSchema.safeParse(messagePage);

      expect(result.success).toBe(true);
    });
  });
});
