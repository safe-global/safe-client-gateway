import { getAddress } from 'viem';
import { faker } from '@faker-js/faker';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

describe('AddressSchema', () => {
  it('should validate a valid address', () => {
    const value = getAddress(faker.finance.ethereumAddress());

    const result = AddressSchema.safeParse(value);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('AddressSchema failed to validate a valid address.');
    }
    expect(result.data).toBe(value);
  });

  it('should not validate a non-address', () => {
    const value = faker.string.alphanumeric();

    const result = AddressSchema.safeParse(value);

    expect(result.success).toBe(false);
  });

  it('should checksum a valid, non-checksummed address', () => {
    const value = faker.finance.ethereumAddress().toLowerCase();

    const result = AddressSchema.safeParse(value);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('AddressSchema failed to validate a valid address.');
    }
    expect(result.data).toBe(getAddress(value));
  });
});
