import { fakeJson } from '@/__tests__/faker';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { messageConfirmationBuilder } from '@/domain/messages/entities/__tests__/message-confirmation.builder';
import { messageBuilder } from '@/domain/messages/entities/__tests__/message.builder';
import { SignatureType } from '@/domain/messages/entities/message-confirmation.entity';
import {
  MessageConfirmationSchema,
  MessagePageSchema,
  MessageSchema,
} from '@/domain/messages/entities/schemas/message.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('Message schemas', () => {
  describe('MessageConfirmationSchema', () => {
    it('should validate a valid MessageConfirmation', () => {
      const messageConfirmation = messageConfirmationBuilder().build();

      const result = MessageConfirmationSchema.safeParse(messageConfirmation);

      expect(result.success).toBe(true);
    });

    it.each(['created' as const, 'modified' as const])(
      'should coerce %s to a date',
      (key) => {
        const messageConfirmation = messageConfirmationBuilder()
          .with(key, faker.date.recent().toISOString() as unknown as Date)
          .build();

        const result = MessageConfirmationSchema.safeParse(messageConfirmation);

        expect(result.success && result.data[key]).toStrictEqual(
          new Date(messageConfirmation[key]),
        );
      },
    );

    it('should checksum the owner', () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase() as `0x${string}`;
      const messageConfirmation = messageConfirmationBuilder()
        .with('owner', nonChecksummedAddress)
        .build();

      const result = MessageConfirmationSchema.safeParse(messageConfirmation);

      expect(result.success && result.data.owner).toBe(
        getAddress(nonChecksummedAddress),
      );
    });

    it('should not allow non-hex signature', () => {
      const messageConfirmation = messageConfirmationBuilder()
        .with('signature', faker.string.numeric() as `0x${string}`)
        .build();

      const result = MessageConfirmationSchema.safeParse(messageConfirmation);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'custom',
            message: 'Invalid hex string',
            path: ['signature'],
          },
        ]),
      );
    });

    it('should not allow invalid signature types', () => {
      const messageConfirmation = messageConfirmationBuilder()
        .with('signatureType', faker.lorem.word() as SignatureType)
        .build();

      const result = MessageConfirmationSchema.safeParse(messageConfirmation);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            received: messageConfirmation.signatureType,
            code: 'invalid_enum_value',
            options: ['CONTRACT_SIGNATURE', 'APPROVED_HASH', 'EOA', 'ETH_SIGN'],
            path: ['signatureType'],
            message: `Invalid enum value. Expected 'CONTRACT_SIGNATURE' | 'APPROVED_HASH' | 'EOA' | 'ETH_SIGN', received '${messageConfirmation.signatureType}'`,
          },
        ]),
      );
    });
  });

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
              message: 'Invalid hex string',
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
