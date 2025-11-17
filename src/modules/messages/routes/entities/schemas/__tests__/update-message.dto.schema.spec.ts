import { updateMessageSignatureDtoBuilder } from '@/modules/messages/routes/entities/__tests__/update-message-signature.dto.builder';
import { UpdateMessageSignatureDtoSchema } from '@/modules/messages/routes/entities/schemas/update-message-signature.dto.schema';
import { faker } from '@faker-js/faker';
import { ZodError } from 'zod';
import type { Address, Hash } from 'viem';

describe('UpdateMessageSignatureDtoSchema', () => {
  it('should validate a valid updateMessageSignatureDto', () => {
    const updateMessageSignatureDto =
      updateMessageSignatureDtoBuilder().build();

    const result = UpdateMessageSignatureDtoSchema.safeParse(
      updateMessageSignatureDto,
    );

    expect(result.success).toBe(true);
  });

  it('should not allow a non-hex signature', () => {
    const updateMessageSignatureDto = updateMessageSignatureDtoBuilder()
      .with('signature', faker.string.alphanumeric() as Address)
      .build();

    const result = UpdateMessageSignatureDtoSchema.safeParse(
      updateMessageSignatureDto,
    );

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'custom',
          message: 'Invalid "0x" notated hex string',
          path: ['signature'],
        },
        {
          code: 'custom',
          message: 'Invalid hex bytes',
          path: ['signature'],
        },
        {
          code: 'custom',
          message: 'Invalid signature',
          path: ['signature'],
        },
      ]),
    );
  });

  it('should not allow non-signature length hex strings', () => {
    const updateMessageSignatureDto = updateMessageSignatureDtoBuilder()
      .with('signature', faker.string.hexadecimal({ length: 129 }) as Hash)
      .build();

    const result = UpdateMessageSignatureDtoSchema.safeParse(
      updateMessageSignatureDto,
    );

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'custom',
          message: 'Invalid hex bytes',
          path: ['signature'],
        },
        {
          code: 'custom',
          message: 'Invalid signature',
          path: ['signature'],
        },
      ]),
    );
  });
});
