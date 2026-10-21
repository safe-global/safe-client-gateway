// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { addressBookItemBuilder } from '#/modules/spaces/domain/address-books/entities/__tests__/address-book-item.db.builder';
import {
  MAX_TAGS_PER_CONTACT,
  TAG_COLORS,
} from '#/modules/spaces/domain/address-books/entities/address-book-tag.entity';
import { UpsertAddressBookItemsSchema } from '#/modules/spaces/routes/address-books/entities/upsert-address-book-items.dto.entity';

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

describe('UpsertAddressBookItemsSchema tags', () => {
  it('should leave tags undefined when omitted', () => {
    const result = UpsertAddressBookItemsSchema.safeParse({
      items: [validItem()],
    });

    expect(result.success && result.data.items[0].tags).toBeUndefined();
  });

  it('should sanitise and dedupe tags when present', () => {
    const tag = faker.string.alpha({ length: 8 });

    const result = UpsertAddressBookItemsSchema.safeParse({
      items: [{ ...validItem(), tags: [`  ${tag} `, tag.toUpperCase()] }],
    });

    expect(result.success && result.data.items[0].tags).toStrictEqual([tag]);
  });

  it('should reject a 4th tag', () => {
    const tags = faker.helpers.uniqueArray(
      () => faker.string.alpha({ length: 8 }),
      MAX_TAGS_PER_CONTACT + 1,
    );

    const result = UpsertAddressBookItemsSchema.safeParse({
      items: [{ ...validItem(), tags }],
    });

    expect(result.success).toBe(false);
  });

  it('should reject an invalid tag name', () => {
    const result = UpsertAddressBookItemsSchema.safeParse({
      items: [{ ...validItem(), tags: ['=bad'] }],
    });

    expect(result.success).toBe(false);
  });
});

describe('UpsertAddressBookItemsSchema tagColors', () => {
  it('should accept colours for the tags a request creates', () => {
    const name = faker.string.alpha({ length: 8 });
    const tagColors = [{ name, color: faker.helpers.arrayElement(TAG_COLORS) }];

    const result = UpsertAddressBookItemsSchema.safeParse({
      items: [{ ...validItem(), tags: [name] }],
      tagColors,
    });

    expect(result.success && result.data.tagColors).toStrictEqual(tagColors);
  });

  it('should reject a colour that is not a tag colour', () => {
    const result = UpsertAddressBookItemsSchema.safeParse({
      items: [validItem()],
      tagColors: [{ name: faker.string.alpha({ length: 8 }), color: 'orchid' }],
    });

    expect(result.success).toBe(false);
  });
});
