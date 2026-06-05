// SPDX-License-Identifier: FSL-1.1-MIT
import { addressBookItemBuilder } from '@/modules/spaces/domain/address-books/entities/__tests__/address-book-item.db.builder';
import { UpsertAddressBookItemsSchema } from '@/modules/spaces/routes/entities/upsert-address-book-items.dto.entity';

const validItem = (): {
  name: string;
  address: string;
  chainIds: Array<string>;
} => {
  const { name, address, chainIds } = addressBookItemBuilder().build();
  return { name, address, chainIds };
};

describe('UpsertAddressBookItemsSchema', () => {
  it('should validate a well-formed payload', () => {
    const result = UpsertAddressBookItemsSchema.safeParse({
      items: [validItem()],
    });

    expect(result.success).toBe(true);
  });

  it('should require a name', () => {
    const { name: _name, ...item } = validItem();

    const result = UpsertAddressBookItemsSchema.safeParse({ items: [item] });

    expect(result.success).toBe(false);
  });

  it('should reject a name with invalid special characters', () => {
    const result = UpsertAddressBookItemsSchema.safeParse({
      items: [{ ...validItem(), name: '<>@!' }],
    });

    expect(result.success).toBe(false);
  });

  it('should reject a non-numeric chain id', () => {
    const result = UpsertAddressBookItemsSchema.safeParse({
      items: [{ ...validItem(), chainIds: ['mainnet'] }],
    });

    expect(result.success).toBe(false);
  });

  it('should reject an invalid address', () => {
    const result = UpsertAddressBookItemsSchema.safeParse({
      items: [{ ...validItem(), address: 'not-an-address' }],
    });

    expect(result.success).toBe(false);
  });
});
