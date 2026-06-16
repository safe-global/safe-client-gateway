// SPDX-License-Identifier: FSL-1.1-MIT
import { addressBookItemBuilder } from '@/modules/spaces/domain/address-books/entities/__tests__/address-book-item.db.builder';
import { CreateAddressBookRequestSchema } from '@/modules/spaces/routes/entities/address-book-request.dto.entity';

const validRequest = (): {
  name: string;
  address: string;
  chainIds: Array<string>;
} => {
  const { name, address, chainIds } = addressBookItemBuilder().build();
  return { name, address, chainIds };
};

describe('CreateAddressBookRequestSchema', () => {
  it('should validate a well-formed payload', () => {
    const result = CreateAddressBookRequestSchema.safeParse(validRequest());

    expect(result.success).toBe(true);
  });

  it('should require a name', () => {
    const { name: _name, ...request } = validRequest();

    const result = CreateAddressBookRequestSchema.safeParse(request);

    expect(result.success).toBe(false);
  });

  it('should reject a name with invalid special characters', () => {
    const result = CreateAddressBookRequestSchema.safeParse({
      ...validRequest(),
      name: '<>@!',
    });

    expect(result.success).toBe(false);
  });

  it('should reject a name longer than 50 characters', () => {
    const result = CreateAddressBookRequestSchema.safeParse({
      ...validRequest(),
      name: 'a'.repeat(51),
    });

    expect(result.success).toBe(false);
  });

  it('should reject an invalid address', () => {
    const result = CreateAddressBookRequestSchema.safeParse({
      ...validRequest(),
      address: 'not-an-address',
    });

    expect(result.success).toBe(false);
  });

  it('should reject a non-numeric chain id', () => {
    const result = CreateAddressBookRequestSchema.safeParse({
      ...validRequest(),
      chainIds: ['mainnet'],
    });

    expect(result.success).toBe(false);
  });

  it('should reject empty chainIds', () => {
    const result = CreateAddressBookRequestSchema.safeParse({
      ...validRequest(),
      chainIds: [],
    });

    expect(result.success).toBe(false);
  });

  it('should deduplicate chainIds', () => {
    const result = CreateAddressBookRequestSchema.safeParse({
      ...validRequest(),
      chainIds: ['1', '1', '10'],
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.chainIds).toEqual(['1', '10']);
  });
});
