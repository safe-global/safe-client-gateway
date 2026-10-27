// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { BooleanStringSchema } from '#/validation/entities/schemas/boolean-string.schema';

describe('BooleanStringSchema', () => {
  it.each([
    ['true', true],
    ['false', false],
  ])('should parse %s as %s', (value, expected) => {
    const result = BooleanStringSchema.safeParse(value);

    expect(result.success).toBe(true);
    expect(result.success && result.data).toBe(expected);
  });

  it.each(['1', '0', 'yes', 'TRUE', ''])('should reject %j', (value) => {
    expect(BooleanStringSchema.safeParse(value).success).toBe(false);
  });

  it('should reject any other string', () => {
    const value = faker.string.alpha({ length: { min: 1, max: 10 } });

    expect(BooleanStringSchema.safeParse(value).success).toBe(false);
  });
});
