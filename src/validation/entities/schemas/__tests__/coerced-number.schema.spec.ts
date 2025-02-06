import { CoercedNumberSchema } from '@/validation/entities/schemas/coerced-number.schema';
import { faker } from '@faker-js/faker';

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
