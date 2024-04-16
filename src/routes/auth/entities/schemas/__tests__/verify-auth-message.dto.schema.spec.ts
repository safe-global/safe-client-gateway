import { siweMessageBuilder } from '@/domain/siwe/entities/__tests__/siwe-message.builder';
import { VerifyAuthMessageDtoSchema } from '@/routes/auth/entities/verify-auth-message.dto.entity';
import { faker } from '@faker-js/faker';

const MAX_VALIDITY_PERIOD_IN_MS = 15 * 60 * 1_000; // 15 minutes

describe('VerifyAuthMessageDto', () => {
  it('should validate a VerifyAuthMessageDto', () => {
    const expirationTime = faker.date.between({
      from: new Date(),
      to: new Date(Date.now() + MAX_VALIDITY_PERIOD_IN_MS),
    });
    const verifyAuthMessageDto = {
      message: siweMessageBuilder()
        .with('expirationTime', expirationTime.toISOString())
        .build(),
      signature: faker.string.hexadecimal(),
    };

    const result = VerifyAuthMessageDtoSchema.safeParse(verifyAuthMessageDto);

    expect(result.success).toBe(true);
  });

  it.each([['message' as const], ['signature' as const]])(
    'should not allow %s to be undefined',
    (key) => {
      const expirationTime = faker.date.between({
        from: new Date(),
        to: new Date(Date.now() + MAX_VALIDITY_PERIOD_IN_MS),
      });
      const verifyAuthMessageDto = {
        message: siweMessageBuilder()
          .with('expirationTime', expirationTime.toISOString())
          .build(),
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
