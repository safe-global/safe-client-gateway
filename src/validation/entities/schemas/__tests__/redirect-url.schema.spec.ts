// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { RedirectUrlSchema } from '@/validation/entities/schemas/redirect-url.schema';

describe('RedirectUrlSchema', () => {
  it('should validate a relative path', () => {
    const path = `/${faker.word.noun()}`;
    const result = RedirectUrlSchema.safeParse(path);

    expect(result.success && result.data).toBe(path);
  });

  it('should validate an absolute URL', () => {
    const url =
      faker.internet.url({ appendSlash: false }) + `/${faker.word.noun()}`;
    const result = RedirectUrlSchema.safeParse(url);

    expect(result.success && result.data).toBe(url);
  });

  it('should allow undefined (optional)', () => {
    const result = RedirectUrlSchema.safeParse(undefined);

    expect(result.success && result.data).toBeUndefined();
  });

  it('should reject a string exceeding 2048 characters', () => {
    const longUrl =
      faker.internet.url({ appendSlash: false }) + '/' + 'a'.repeat(2048);
    const result = RedirectUrlSchema.safeParse(longUrl);

    expect(result.success).toBe(false);
  });

  it('should accept a string of exactly 2048 characters', () => {
    const maxUrl = '/' + 'a'.repeat(2047);
    const result = RedirectUrlSchema.safeParse(maxUrl);

    expect(result.success).toBe(true);
  });

  it.each([
    '\r',
    '\n',
    '\0',
    '\t',
    '\x1f',
    '\x7f',
  ])('should reject a string containing control character %j', (char) => {
    const url = faker.internet.url({ appendSlash: false }) + `/${char}injected`;
    const result = RedirectUrlSchema.safeParse(url);

    expect(result.success).toBe(false);
  });

  it('should reject non-string types', () => {
    expect(RedirectUrlSchema.safeParse(faker.number.int()).success).toBe(false);
    expect(RedirectUrlSchema.safeParse(faker.datatype.boolean()).success).toBe(
      false,
    );
    expect(RedirectUrlSchema.safeParse({}).success).toBe(false);
  });
});
