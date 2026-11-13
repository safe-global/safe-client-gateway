// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import {
  MAX_TAGS_PER_CONTACT,
  normalizeTagNameKey,
  TAG_NAME_MAX_LENGTH,
  TagNameSchema,
  TagNamesSchema,
} from '#/modules/spaces/domain/address-books/entities/address-book-tag.entity';

describe('TagNameSchema', () => {
  it('trims and accepts letters, numbers, spaces and - _ & /', () => {
    expect(TagNameSchema.parse('  R&D / Ops-1_a  ')).toBe('R&D / Ops-1_a');
  });

  it('collapses runs of spaces inside a name to one', () => {
    expect(TagNameSchema.parse('Vendor  Ops')).toBe('Vendor Ops');
    // After sanitising: the zero-width space goes first, then the run collapses.
    expect(TagNameSchema.parse(' Vendor \u200b  Ops ')).toBe('Vendor Ops');
  });

  it.each([
    ['Signer', 'Signer'],
    ['signer', 'signer'],
    [' SIGNER ', 'SIGNER'],
    ['Workspace Safe', 'Workspace Safe'],
    ['workspace   safe', 'workspace safe'],
    ['  WORKSPACE SAFE ', 'WORKSPACE SAFE'],
  ])('rejects %j (not allowed)', (name, normalised) => {
    const result = TagNameSchema.safeParse(name);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(
      `'${normalised}' is added automatically and can't be used as a tag name`,
    );
  });

  it.each(['Signer team', 'Signers', 'Workspace Safes', 'Safe'])(
    'accepts %s, which only contains a disallowed name',
    (name) => {
      expect(TagNameSchema.parse(name)).toBe(name);
    },
  );

  it('rejects a disallowed name inside a list of tags', () => {
    expect(
      TagNamesSchema.safeParse([faker.word.noun(), 'signer']).success,
    ).toBe(false);
  });

  it.each(['=SUM(1)', '+1', '-x', '@alice'])(
    'rejects %s (formula prefix)',
    (name) => {
      expect(TagNameSchema.safeParse(name).success).toBe(false);
    },
  );

  it.each(['a"b', 'a<b', 'a$b', 'a.b'])(
    'rejects %s (disallowed character)',
    (name) => {
      expect(TagNameSchema.safeParse(name).success).toBe(false);
    },
  );

  it('rejects an empty name and one longer than the limit', () => {
    expect(TagNameSchema.safeParse('   ').success).toBe(false);
    expect(
      TagNameSchema.safeParse(faker.string.alpha(TAG_NAME_MAX_LENGTH + 1))
        .success,
    ).toBe(false);
    expect(
      TagNameSchema.safeParse(faker.string.alpha(TAG_NAME_MAX_LENGTH)).success,
    ).toBe(true);
  });
});

describe('TagNamesSchema', () => {
  it('merges case and whitespace duplicates, keeping the first spelling', () => {
    expect(
      TagNamesSchema.parse(['Vendor', ' vendor ', 'VENDOR', 'Payroll']),
    ).toEqual(['Vendor', 'Payroll']);
  });

  it('merges names that differ only in runs of inner spaces, keeping the first spelling', () => {
    expect(TagNamesSchema.parse(['Vendor  Ops', 'vendor ops'])).toEqual([
      'Vendor Ops',
    ]);
  });

  it('allows the limit after deduplication and rejects one more', () => {
    const names = faker.helpers.uniqueArray(
      () => faker.string.alpha({ length: 8 }),
      MAX_TAGS_PER_CONTACT + 1,
    );
    expect(
      TagNamesSchema.safeParse(names.slice(0, MAX_TAGS_PER_CONTACT)).success,
    ).toBe(true);
    expect(TagNamesSchema.safeParse(names).success).toBe(false);
  });
});

describe('normalizeTagNameKey', () => {
  it('gives names that render the same, in any case, one key', () => {
    const name = faker.string.alpha({ length: 8 });

    expect(normalizeTagNameKey(` ${name.toUpperCase()}  Ops\u200B `)).toBe(
      normalizeTagNameKey(`${name.toLowerCase()} ops`),
    );
  });
});
