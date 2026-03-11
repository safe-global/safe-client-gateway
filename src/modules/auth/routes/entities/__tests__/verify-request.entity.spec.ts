import { VerifyAuthRequestSchema } from '@/modules/auth/routes/entities/verify-auth.request.entity';
import { siweMessageBuilder } from '@/modules/siwe/domain/entities/__tests__/siwe-message.builder';
import { faker } from '@faker-js/faker';
import jwt from 'jsonwebtoken';
import { createSiweMessage } from 'viem/siwe';

describe('VerifyAuthRequestSchema', () => {
  it('should validate a SIWE request', () => {
    const siweRequest = {
      message: createSiweMessage(siweMessageBuilder().build()),
      signature: faker.string.hexadecimal(),
    };

    const result = VerifyAuthRequestSchema.safeParse(siweRequest);

    expect(result.success).toBe(true);
  });

  it('should validate an Auth0 request', () => {
    const auth0Request = {
      access_token: jwt.sign(
        { sub: faker.string.uuid() },
        faker.string.alphanumeric(32),
        { algorithm: 'HS256' },
      ),
    };

    const result = VerifyAuthRequestSchema.safeParse(auth0Request);

    expect(result.success).toBe(true);
  });

  it('should not validate an empty object', () => {
    const result = VerifyAuthRequestSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it('should not validate a request with both SIWE and Auth0 fields', () => {
    const result = VerifyAuthRequestSchema.safeParse({
      message: createSiweMessage(siweMessageBuilder().build()),
      signature: faker.string.hexadecimal(),
      access_token: jwt.sign(
        { sub: faker.string.uuid() },
        faker.string.alphanumeric(32),
        { algorithm: 'HS256' },
      ),
    });

    expect(result.success).toBe(false);
  });

  it('should not validate an object with unrelated fields', () => {
    const result = VerifyAuthRequestSchema.safeParse({
      foo: faker.string.alpha(),
    });

    expect(result.success).toBe(false);
  });
});
