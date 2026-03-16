// SPDX-License-Identifier: FSL-1.1-MIT
import { auth0DtoBuilder } from '@/modules/auth/routes/entities/__tests__/auth0.dto.builder';
import { Auth0DtoSchema } from '@/modules/auth/routes/entities/auth0.dto.entity';
import { faker } from '@faker-js/faker';
import { generateKeyPairSync } from 'crypto';
import jwt from 'jsonwebtoken';

describe('Auth0DtoSchema', () => {
  const invalidJwtError = {
    code: 'invalid_format',
    format: 'jwt',
    path: ['access_token'],
    message: 'Invalid JWT',
  };

  it('should validate Auth0Dto', () => {
    const auth0Dto = auth0DtoBuilder().build();

    const result = Auth0DtoSchema.safeParse(auth0Dto);
    expect(result.success).toBe(true);
  });

  it('should not validate a non-JWT access_token', () => {
    const result = Auth0DtoSchema.safeParse({
      access_token: faker.string.alpha(),
    });

    expect(!result.success && result.error.issues).toStrictEqual([
      invalidJwtError,
    ]);
  });

  it('should not validate a JWT with a non-HS256 algorithm', () => {
    const { privateKey } = generateKeyPairSync('ec', {
      namedCurve: 'P-256',
    });
    const accessToken = jwt.sign({ sub: faker.string.uuid() }, privateKey, {
      algorithm: 'ES256',
    });

    const result = Auth0DtoSchema.safeParse({ access_token: accessToken });

    expect(!result.success && result.error.issues).toStrictEqual([
      invalidJwtError,
    ]);
  });

  it('should not validate a missing access_token', () => {
    const result = Auth0DtoSchema.safeParse({});

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        path: ['access_token'],
        message: 'Invalid input: expected string, received undefined',
      },
    ]);
  });
});
