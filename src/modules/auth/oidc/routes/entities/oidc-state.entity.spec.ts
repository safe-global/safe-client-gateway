// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { OidcStateSchema } from '@/modules/auth/oidc/routes/entities/oidc-state.entity';

describe('OidcStateSchema', () => {
  describe('csrf', () => {
    it('should accept a valid 64-char hex string', () => {
      const csrf = faker.string.hexadecimal({
        length: 64,
        casing: 'lower',
        prefix: '',
      });
      const result = OidcStateSchema.safeParse({ csrf });

      expect(result.success && result.data).toEqual({ csrf });
    });

    it('should reject a csrf shorter than 64 characters', () => {
      const csrf = faker.string.hexadecimal({
        length: 63,
        casing: 'lower',
        prefix: '',
      });
      const result = OidcStateSchema.safeParse({ csrf });

      expect(result.success).toBe(false);
    });

    it('should reject a csrf longer than 64 characters', () => {
      const csrf = faker.string.hexadecimal({
        length: 65,
        casing: 'lower',
        prefix: '',
      });
      const result = OidcStateSchema.safeParse({ csrf });

      expect(result.success).toBe(false);
    });

    it('should reject a csrf with non-hex characters', () => {
      const csrf = 'g'.repeat(64);
      const result = OidcStateSchema.safeParse({ csrf });

      expect(result.success).toBe(false);
    });

    it('should reject a missing csrf', () => {
      const result = OidcStateSchema.safeParse({});

      expect(result.success).toBe(false);
    });
  });

  describe('redirectUrl', () => {
    it('should accept a valid absolute URL', () => {
      const redirectUrl = `${faker.internet.url({ appendSlash: false })}/${faker.word.noun()}`;
      const csrf = faker.string.hexadecimal({
        length: 64,
        casing: 'lower',
        prefix: '',
      });
      const result = OidcStateSchema.safeParse({ csrf, redirectUrl });

      expect(result.success && result.data).toEqual({ csrf, redirectUrl });
    });

    it('should allow redirectUrl to be omitted', () => {
      const csrf = faker.string.hexadecimal({
        length: 64,
        casing: 'lower',
        prefix: '',
      });
      const result = OidcStateSchema.safeParse({ csrf });

      expect(result.success && result.data).toEqual({ csrf });
    });

    it('should reject an empty redirectUrl', () => {
      const csrf = faker.string.hexadecimal({
        length: 64,
        casing: 'lower',
        prefix: '',
      });
      const result = OidcStateSchema.safeParse({ csrf, redirectUrl: '' });

      expect(result.success).toBe(false);
    });

    it('should reject a redirectUrl exceeding 2048 characters', () => {
      const csrf = faker.string.hexadecimal({
        length: 64,
        casing: 'lower',
        prefix: '',
      });
      const redirectUrl = `/${'a'.repeat(2048)}`;
      const result = OidcStateSchema.safeParse({ csrf, redirectUrl });

      expect(result.success).toBe(false);
    });
  });
});
