import { faker } from '@faker-js/faker';
import { HexBytesSchema } from '@/validation/entities/schemas/hexbytes.schema';

describe('HexBytesSchema', () => {
  it('should return true if the value is a valid hex bytes', () => {
    const value = faker.string.hexadecimal({ length: 4 });

    const result = HexBytesSchema.safeParse(value);

    expect(result.success).toBe(true);
  });

  it('should return false if the value is not a valid hex bytes', () => {
    const value = faker.string.hexadecimal({ length: 3 });

    const result = HexBytesSchema.safeParse(value);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid hex bytes',
        path: [],
      },
    ]);
  });
});
