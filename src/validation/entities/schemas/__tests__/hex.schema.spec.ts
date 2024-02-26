import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { faker } from '@faker-js/faker';

describe('HexSchema', () => {
  it('should validate a valid hex string', () => {
    const value = faker.string.hexadecimal();

    const result = HexSchema.safeParse(value);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('HexSchema failed to validate a valid hex string.');
    }
    expect(result.data).toBe(value);
  });

  it('should not validate a non-hex string', () => {
    const value = faker.string.alphanumeric();

    const result = HexSchema.safeParse(value);

    expect(result.success).toBe(false);
  });
});
