import type { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { messageConfirmationBuilder } from '@/modules/messages/domain/entities/__tests__/message-confirmation.builder';
import { MessageConfirmationSchema } from '@/modules/messages/domain/entities/message-confirmation.entity';
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';

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
      .toLowerCase() as Address;
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
      .with('signature', faker.string.numeric() as Address)
      .build();

    const result = MessageConfirmationSchema.safeParse(messageConfirmation);

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'custom',
        message: 'Invalid "0x" notated hex string',
        path: ['signature'],
      }),
      expect.objectContaining({
        code: 'custom',
        message: 'Invalid hex bytes',
        path: ['signature'],
      }),
    ]);
  });

  it('should not allow invalid signature types', () => {
    const messageConfirmation = messageConfirmationBuilder()
      .with('signatureType', faker.lorem.word() as SignatureType)
      .build();

    const result = MessageConfirmationSchema.safeParse(messageConfirmation);

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid_value',
        values: ['CONTRACT_SIGNATURE', 'APPROVED_HASH', 'EOA', 'ETH_SIGN'],
        path: ['signatureType'],
        message:
          'Invalid option: expected one of "CONTRACT_SIGNATURE"|"APPROVED_HASH"|"EOA"|"ETH_SIGN"',
      }),
    ]);
  });
});
