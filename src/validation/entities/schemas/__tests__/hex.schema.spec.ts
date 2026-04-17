// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

describe('HexSchema', () => {
  it('should validate a valid hex string', () => {
    const value = faker.string.hexadecimal();

    const result = HexSchema.safeParse(value);

    expect(result.success && result.data).toBe(value);
  });

  it('should not validate a non-hex string', () => {
    const value = faker.string.alphanumeric();

    const result = HexSchema.safeParse(value);

    expect(result.success).toBe(false);
  });
});
