// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { MAX_TAGS_PER_CONTACT } from '#/modules/spaces/domain/address-books/entities/address-book-tag.entity';
import {
  RenameTagSchema,
  SetContactTagsSchema,
} from '#/modules/spaces/routes/address-books/entities/address-book-tags.dto.entity';

const tagNames = (count: number): Array<string> =>
  faker.helpers.uniqueArray(() => faker.string.alpha({ length: 8 }), count);

const item = (
  tags: Array<string> = tagNames(1),
): { address: string; tags: Array<string> } => ({
  address: getAddress(faker.finance.ethereumAddress()),
  tags,
});

describe('SetContactTagsSchema', () => {
  it('should accept a valid batch', () => {
    const result = SetContactTagsSchema.safeParse({
      items: [item(), item([])],
    });

    expect(result.success).toBe(true);
  });

  it('should reject an empty items array', () => {
    expect(SetContactTagsSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it('should reject the same address twice, case-insensitively', () => {
    const first = item();
    const second = { ...item(), address: first.address.toLowerCase() };

    const result = SetContactTagsSchema.safeParse({ items: [first, second] });

    expect(result.success).toBe(false);
  });

  it('should reject a 4th tag on an item', () => {
    const result = SetContactTagsSchema.safeParse({
      items: [item(tagNames(MAX_TAGS_PER_CONTACT + 1))],
    });

    expect(result.success).toBe(false);
  });

  it('should reject an invalid address', () => {
    const result = SetContactTagsSchema.safeParse({
      items: [{ ...item(), address: 'not-an-address' }],
    });

    expect(result.success).toBe(false);
  });
});

describe('RenameTagSchema', () => {
  it('should sanitise the name', () => {
    const name = faker.string.alpha({ length: 8 });

    const result = RenameTagSchema.safeParse({ name: `  ${name}  ` });

    expect(result.success && result.data.name).toBe(name);
  });

  it.each(['', '   ', '=formula', 'bad<name>'])('should reject %j', (name) => {
    expect(RenameTagSchema.safeParse({ name }).success).toBe(false);
  });

  it('should reject a missing name', () => {
    expect(RenameTagSchema.safeParse({}).success).toBe(false);
  });
});
