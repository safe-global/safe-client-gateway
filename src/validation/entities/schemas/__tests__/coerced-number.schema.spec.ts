// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { CoercedNumberSchema } from '@/validation/entities/schemas/coerced-number.schema';

describe('CoercedNumberSchema', () => {
  it('should return a number as is', () => {
    const value = faker.number.int();

    const result = CoercedNumberSchema.safeParse(value);

    expect(result.success && result.data).toBe(value);
  });

  it('should coerce a numeric string to a number', () => {
    const value = faker.string.numeric();

    const result = CoercedNumberSchema.safeParse(value);

    expect(result.success && result.data).toBe(Number(value));
  });
});
