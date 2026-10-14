// SPDX-License-Identifier: FSL-1.1-MIT
import {
  ExperimentalFeatures,
  ExperimentalFeaturesSchema,
} from '#/modules/spaces/domain/entities/experimental-feature.entity';

describe('ExperimentalFeaturesSchema', () => {
  it('parses a known feature', () => {
    const result = ExperimentalFeaturesSchema.safeParse(['recipientAllowlist']);

    expect(result.success).toBe(true);
    expect(result.data).toStrictEqual(['recipientAllowlist']);
  });

  it('parses an empty array', () => {
    const result = ExperimentalFeaturesSchema.safeParse([]);

    expect(result.success).toBe(true);
    expect(result.data).toStrictEqual([]);
  });

  it('rejects undefined', () => {
    const result = ExperimentalFeaturesSchema.safeParse(undefined);

    expect(result.success).toBe(false);
  });

  it('dedupes repeated values', () => {
    const result = ExperimentalFeaturesSchema.safeParse([
      'recipientAllowlist',
      'recipientAllowlist',
    ]);

    expect(result.success).toBe(true);
    expect(result.data).toStrictEqual(['recipientAllowlist']);
  });

  it.each([
    ['an unknown feature', ['notAFeature']],
    ['a bare string', 'recipientAllowlist'],
    ['an object', { recipientAllowlist: true }],
    ['a non-string element', [1]],
    ['null', null],
  ])('rejects %s', (_label, value) => {
    expect(ExperimentalFeaturesSchema.safeParse(value).success).toBe(false);
  });

  it('accepts every declared feature', () => {
    const result = ExperimentalFeaturesSchema.safeParse([
      ...ExperimentalFeatures,
    ]);

    expect(result.success).toBe(true);
    expect(result.data).toStrictEqual([...ExperimentalFeatures]);
  });
});
