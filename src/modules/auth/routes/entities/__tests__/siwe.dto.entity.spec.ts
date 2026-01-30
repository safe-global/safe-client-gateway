import { siweMessageBuilder } from '@/modules/siwe/domain/entities/__tests__/siwe-message.builder';
import { SiweDtoSchema } from '@/modules/auth/routes/entities/siwe.dto.entity';
import { faker } from '@faker-js/faker';
import { createSiweMessage } from 'viem/siwe';

describe('SiweDtoSchema', () => {
  it('should validate a valid SiweDto', () => {
    const siweDto = {
      message: createSiweMessage(siweMessageBuilder().build()),
      signature: faker.string.hexadecimal(),
    };

    const result = SiweDtoSchema.safeParse(siweDto);

    expect(result.success).toBe(true);
  });

  it('should not validate a non-string message', () => {
    const siweDto = {
      message: faker.number.int(),
      signature: faker.string.hexadecimal(),
    };

    const result = SiweDtoSchema.safeParse(siweDto);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received number',
        path: ['message'],
      },
    ]);
  });

  it('should not validate a non-hex signature', () => {
    const siweDto = {
      message: createSiweMessage(siweMessageBuilder().build()),
      signature: faker.string.alpha(),
    };

    const result = SiweDtoSchema.safeParse(siweDto);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid "0x" notated hex string',
        path: ['signature'],
      },
    ]);
  });
});
