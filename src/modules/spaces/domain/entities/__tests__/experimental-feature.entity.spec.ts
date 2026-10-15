// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import {
  ExperimentalFeatures,
  ExperimentalFeaturesSchema,
} from '#/modules/spaces/domain/entities/experimental-feature.entity';

describe('ExperimentalFeaturesSchema', () => {
  it('rejects more entries than there are features', () => {
    const result = ExperimentalFeaturesSchema.safeParse(
      Array.from({ length: ExperimentalFeatures.length + 1 }, () =>
        faker.helpers.arrayElement(ExperimentalFeatures),
      ),
    );

    expect(result.success).toBe(false);
  });

  it('rejects an unknown feature', () => {
    const result = ExperimentalFeaturesSchema.safeParse([
      faker.string.alpha({ length: 8, casing: 'lower' }),
    ]);

    expect(result.success).toBe(false);
  });
});
