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

  it('should allow leading zero integer strings', () => {
    const value = `0${faker.number.int()}`;

    const result = NumericStringSchema.safeParse(value);

    expect(result.success && result.data).toBe(value);
  });

  it('should allow leading zero float strings', () => {
    const value = `0${faker.number.float()}`;

    const result = NumericStringSchema.safeParse(value);

    expect(result.success && result.data).toBe(value);
  });

  it('should allow negative integer strings', () => {
    const value = `-${faker.number.int()}`;

    const result = NumericStringSchema.safeParse(value);

    expect(result.success && result.data).toBe(value);
  });

  it('should allow negative float strings', () => {
    const value = `-${faker.number.float()}`;

    const result = NumericStringSchema.safeParse(value);

    expect(result.success && result.data).toBe(value);
  });

  it('should not validate a non-numeric string', () => {
    const value = faker.datatype.boolean();

    const result = NumericStringSchema.safeParse(value);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Expected string, received boolean',
        path: [],
        received: 'boolean',
      },
    ]);
  });

  it('should throw for empty strings', () => {
    const value = '';

    const result = NumericStringSchema.safeParse(value);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid base-10 numeric string',
        path: [],
      },
    ]);
  });

  it('should throw for hex strings', () => {
    const value = faker.string.hexadecimal();

    const result = NumericStringSchema.safeParse(value);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid base-10 numeric string',
        path: [],
      },
    ]);
  });
});
