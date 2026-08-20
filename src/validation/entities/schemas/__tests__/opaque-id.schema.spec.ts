// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { OPAQUE_ID_MAXLENGTH } from '@/routes/common/constants';
import { OpaqueIdSchema } from '@/validation/entities/schemas/opaque-id.schema';

describe('OpaqueIdSchema', () => {
  it('should validate a long numeric id, as the relay provider returns', () => {
    const value = faker.string.numeric({ length: 73 });

    const result = OpaqueIdSchema.safeParse(value);

    expect(result.success && result.data).toBe(value);
  });

  it('should validate a UUID', () => {
    const value = faker.string.uuid();

    const result = OpaqueIdSchema.safeParse(value);

    expect(result.success && result.data).toBe(value);
  });

  it('should validate a "0x" prefixed hex string', () => {
    const value = faker.string.hexadecimal({ length: 64 });

    const result = OpaqueIdSchema.safeParse(value);

    expect(result.success && result.data).toBe(value);
  });

  it('should validate an id of the maximum length', () => {
    const value = faker.string.alphanumeric({ length: OPAQUE_ID_MAXLENGTH });

    const result = OpaqueIdSchema.safeParse(value);

    expect(result.success && result.data).toBe(value);
  });

  it.each([
    ['path traversal', '../../admin'],
    ['a slash', `${faker.string.alphanumeric(8)}/status`],
    ['query injection', `${faker.string.alphanumeric(8)}?logs=true`],
    ['a fragment', `${faker.string.alphanumeric(8)}#top`],
    [
      'whitespace',
      `${faker.string.alphanumeric(4)} ${faker.string.alphanumeric(4)}`,
    ],
  ])('should not validate an id containing %s', (_, value) => {
    const result = OpaqueIdSchema.safeParse(value);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_format',
        format: 'regex',
        pattern: '/^[A-Za-z0-9_-]+$/',
        message: 'Invalid string: must match pattern /^[A-Za-z0-9_-]+$/',
        origin: 'string',
        path: [],
      },
    ]);
  });

  it('should not validate an empty string', () => {
    const result = OpaqueIdSchema.safeParse('');

    expect(result.success).toBe(false);
  });

  it('should not validate an id longer than the maximum', () => {
    const value = faker.string.alphanumeric({
      length: OPAQUE_ID_MAXLENGTH + 1,
    });

    const result = OpaqueIdSchema.safeParse(value);

    expect(result.success).toBe(false);
  });

  it('should not validate a non-string', () => {
    const result = OpaqueIdSchema.safeParse(faker.number.int());

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received number',
        path: [],
      },
    ]);
  });
});
