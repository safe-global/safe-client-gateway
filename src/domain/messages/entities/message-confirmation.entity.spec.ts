import { messageConfirmationBuilder } from '@/domain/messages/entities/__tests__/message-confirmation.builder';
import {
  MessageConfirmationSchema,
  SignatureType,
} from '@/domain/messages/entities/message-confirmation.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

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
          message: 'Invalid "0x" notated hex string',
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
