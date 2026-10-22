// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { BooleanStringSchema } from '#/validation/entities/schemas/boolean-string.schema';

describe('BooleanStringSchema', () => {
  it('should parse "true" to true', () => {
    const result = BooleanStringSchema.safeParse('true');

    expect(result.success).toBe(true);
    expect(result.success && result.data).toBe(true);
  });

  it('should parse "false" to false', () => {
    const result = BooleanStringSchema.safeParse('false');

    expect(result.success).toBe(true);
    expect(result.success && result.data).toBe(false);
  });

  it('should reject any other string', () => {
    const result = BooleanStringSchema.safeParse(faker.string.alpha(6));

    expect(result.success).toBe(false);
  });
});
