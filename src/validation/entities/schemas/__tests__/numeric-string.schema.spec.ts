import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { faker } from '@faker-js/faker';

describe('NumericStringSchema', () => {
  it('should validate a valid integer string', () => {
    const value = faker.number.int().toString();

    const result = NumericStringSchema.safeParse(value);

    expect(result.success && result.data).toBe(value);
  });

  it('should validate a valid float string', () => {
    const value = faker.number.float().toString();

    const result = NumericStringSchema.safeParse(value);

    expect(result.success && result.data).toBe(value);
  });

  it('should not validate a non-numeric string', () => {
    const value = faker.datatype.boolean();

    const result = NumericStringSchema.safeParse(value);

    expect(result.success).toBe(false);
  });
});
