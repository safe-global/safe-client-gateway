// SPDX-License-Identifier: FSL-1.1-MIT
import { auth0DtoBuilder } from '@/modules/auth/routes/entities/__tests__/auth0.dto.builder';
import { VerifyAuthRequestSchema } from '@/modules/auth/routes/entities/verify-auth.request.entity';
import { siweMessageBuilder } from '@/modules/siwe/domain/entities/__tests__/siwe-message.builder';
import { faker } from '@faker-js/faker';
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
    const auth0Request = auth0DtoBuilder().build();

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
      ...auth0DtoBuilder().build(),
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
