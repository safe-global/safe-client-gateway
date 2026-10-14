// SPDX-License-Identifier: FSL-1.1-MIT
import { ExperimentalFeaturesSchema } from '#/modules/spaces/domain/entities/experimental-feature.entity';

describe('ExperimentalFeaturesSchema', () => {
  it('dedupes repeated values', () => {
    const result = ExperimentalFeaturesSchema.safeParse([
      'recipientAllowlist',
      'recipientAllowlist',
    ]);

    expect(result.success).toBe(true);
    expect(result.data).toStrictEqual(['recipientAllowlist']);
  });

  it('rejects an unknown feature', () => {
    const result = ExperimentalFeaturesSchema.safeParse(['notAFeature']);

    expect(result.success).toBe(false);
  });
});
