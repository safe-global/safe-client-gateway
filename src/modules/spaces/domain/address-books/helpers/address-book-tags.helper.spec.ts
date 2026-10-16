// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { DB_MAX_SAFE_INTEGER } from '#/domain/common/constants';
import type { SpaceTags } from '#/modules/spaces/domain/address-books/entities/address-book-tag-write.entity';
import {
  groupTagIdsByItemId,
  isSameSet,
  nameOf,
} from '#/modules/spaces/domain/address-books/helpers/address-book-tags.helper';

/** Distinct row ids. */
function ids(count: number): Array<number> {
  return faker.helpers.uniqueArray(
    () => faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }),
    count,
  );
}

describe('address-book-tags.helper', () => {
  describe('groupTagIdsByItemId', () => {
    it('groups the tag ids of each item, keeping the link order', () => {
      const [first, second] = ids(2);
      const [a, b, c] = ids(3);

      const grouped = groupTagIdsByItemId([
        { itemId: first, tagId: a },
        { itemId: second, tagId: b },
        { itemId: first, tagId: c },
      ]);

      expect(grouped).toStrictEqual(
        new Map([
          [first, [a, c]],
          [second, [b]],
        ]),
      );
    });

    it('returns an empty map for no links', () => {
      expect(groupTagIdsByItemId([])).toStrictEqual(new Map());
    });
  });

  describe('isSameSet', () => {
    it('ignores order and repeats', () => {
      const [a, b] = ids(2);

      expect(isSameSet([a, b], [b, a])).toBe(true);
      expect(isSameSet([a, a, b], [b, a])).toBe(true);
      expect(isSameSet([], [])).toBe(true);
    });

    it('tells apart sets that differ in a member or in size', () => {
      const [a, b, c] = ids(3);

      expect(isSameSet([a, b], [a, c])).toBe(false);
      expect(isSameSet([a], [a, b])).toBe(false);
      expect(isSameSet([a, b], [a])).toBe(false);
    });
  });

  describe('nameOf', () => {
    const spaceTagsWith = (nameById: Map<number, string>): SpaceTags => ({
      idByIndex: new Map(),
      nameById,
      usedColors: new Set(),
    });

    it('returns the name of a tag of the space', () => {
      const [tagId] = ids(1);
      const name = faker.word.noun();

      expect(nameOf(spaceTagsWith(new Map([[tagId, name]])), tagId)).toBe(name);
    });

    it('throws for a tag that is not a tag of the space', () => {
      const [tagId, otherTagId] = ids(2);

      expect(() =>
        nameOf(
          spaceTagsWith(new Map([[tagId, faker.word.noun()]])),
          otherTagId,
        ),
      ).toThrow(
        new Error(`Tag ${otherTagId} is not a tag of the space being written`),
      );
    });
  });
});
