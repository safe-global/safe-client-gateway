// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { isSameFeatureSet } from '#/modules/spaces/domain/experimental-features.utils';

describe('isSameFeatureSet', () => {
  const first = faker.string.alpha(8);
  const second = faker.string.alpha(8);

  it('is true for the same members in any order', () => {
    expect(isSameFeatureSet([first, second], [second, first])).toBe(true);
  });

  it('is false for a subset', () => {
    expect(isSameFeatureSet([first], [first, second])).toBe(false);
  });

  it('ignores duplicates on either side', () => {
    expect(isSameFeatureSet([first, first], [first])).toBe(true);
  });

  it('is true for two empty sets', () => {
    expect(isSameFeatureSet([], [])).toBe(true);
  });
});
