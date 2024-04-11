import { updateMessageSignatureDtoBuilder } from '@/routes/messages/entities/__tests__/update-message-signature.dto.builder';
import { UpdateMessageSignatureDtoSchema } from '@/routes/messages/entities/schemas/update-message-signature.dto.schema';
import { faker } from '@faker-js/faker';
import { ZodError } from 'zod';

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
      .with('signature', faker.string.alphanumeric() as `0x${string}`)
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
      ]),
    );
  });
});
