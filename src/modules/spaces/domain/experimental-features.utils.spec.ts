// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { ExperimentalFeatures } from '#/modules/spaces/domain/entities/experimental-feature.entity';
import {
  isSameFeatureSet,
  toKnownFeatures,
} from '#/modules/spaces/domain/experimental-features.utils';

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

describe('toKnownFeatures', () => {
  it('keeps known features', () => {
    expect(toKnownFeatures([...ExperimentalFeatures])).toStrictEqual([
      ...ExperimentalFeatures,
    ]);
  });

  it('drops values that are no longer features', () => {
    const feature = faker.helpers.arrayElement(ExperimentalFeatures);
    const stale = faker.string.alpha(8);

    expect(toKnownFeatures([stale, feature])).toStrictEqual([feature]);
  });
});
