import { siweMessageBuilder } from '@/domain/auth/entities/__tests__/siwe-message.builder';
import { VerifyAuthMessageDtoSchema } from '@/routes/auth/entities/schemas/verify-auth-message.dto';
import { faker } from '@faker-js/faker';

describe('VerifyAuthMessageDto', () => {
  it('should validate a VerifyAuthMessageDto', () => {
    const verifyAuthMessageDto = {
      message: siweMessageBuilder().build(),
      signature: faker.string.hexadecimal(),
    };

    const result = VerifyAuthMessageDtoSchema.safeParse(verifyAuthMessageDto);

    expect(result.success).toBe(true);
  });

  it.each([['message' as const], ['signature' as const]])(
    'should not allow %s to be undefined',
    (key) => {
      const verifyAuthMessageDto = {
        message: siweMessageBuilder().build(),
        signature: faker.string.hexadecimal(),
      };
      delete verifyAuthMessageDto[key];

      const result = VerifyAuthMessageDtoSchema.safeParse(verifyAuthMessageDto);

      expect(
        !result.success &&
          result.error.issues.length === 1 &&
          result.error.issues[0].path.length === 1 &&
          result.error.issues[0].path[0] === key,
      ).toBe(true);
    },
  );
});
