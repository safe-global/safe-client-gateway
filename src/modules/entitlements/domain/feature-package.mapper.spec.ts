// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { FeatureKey } from '@/modules/entitlements/domain/entities/feature.entity';
import { FeatureType } from '@/modules/entitlements/domain/entities/feature.entity';
import { mapFeaturePackage } from '@/modules/entitlements/domain/feature-package.mapper';

const featureTypeByKey: Map<FeatureKey, FeatureType> = new Map([
  ['security_hub', FeatureType.Binary],
  ['sso', FeatureType.Binary],
  ['pay_from_safe', FeatureType.Binary],
  ['safe_seats', FeatureType.Metered],
  ['sponsored_transactions', FeatureType.Metered],
  ['swap_fee_tier', FeatureType.Value],
]);

describe('mapFeaturePackage', () => {
  const subscriptionId = faker.string.alphanumeric(24);
  let onWarning: (message: string) => void;

  beforeEach(() => {
    onWarning = vi.fn<(message: string) => void>();
  });

  it('parses binary, metered, unlimited and value metadata entries', () => {
    const result = mapFeaturePackage({
      subscriptionId,
      metadata: {
        FEATURE_SECURITY_HUB: 'true',
        FEATURE_PAY_FROM_SAFE: 'false',
        FEATURE_SAFE_SEATS: '10',
        FEATURE_SPONSORED_TRANSACTIONS: 'unlimited',
        FEATURE_SWAP_FEE_TIER: 'business',
      },
      featureTypeByKey,
      onWarning,
    });

    expect(result).toStrictEqual([
      { featureKey: 'security_hub', enabled: true, quota: null, value: null },
      { featureKey: 'pay_from_safe', enabled: false, quota: null, value: null },
      { featureKey: 'safe_seats', enabled: true, quota: 10, value: null },
      {
        featureKey: 'sponsored_transactions',
        enabled: true,
        quota: null,
        value: null,
      },
      {
        featureKey: 'swap_fee_tier',
        enabled: true,
        quota: null,
        value: 'business',
      },
    ]);
    expect(onWarning).not.toHaveBeenCalled();
  });

  it('warns and skips unknown keys, null values and unparseable values', () => {
    const result = mapFeaturePackage({
      subscriptionId,
      metadata: {
        FEATURE_UNKNOWN_THING: 'true',
        FEATURE_SECURITY_HUB: 'yes',
        FEATURE_SAFE_SEATS: 'ten',
        FEATURE_SWAP_FEE_TIER: '',
        FEATURE_SSO: null,
        UNRELATED_KEY: 'ignored silently',
      },
      featureTypeByKey,
      onWarning,
    });

    expect(result).toStrictEqual([]);
    expect(onWarning).toHaveBeenCalledTimes(5);
  });

  it.each([
    '007',
    '01',
    '1.5',
    '-1',
    '1e3',
  ])('warns and skips the non-canonical metered quota %s', (quota) => {
    const result = mapFeaturePackage({
      subscriptionId,
      metadata: { FEATURE_SAFE_SEATS: quota },
      featureTypeByKey,
      onWarning,
    });

    expect(result).toStrictEqual([]);
    expect(onWarning).toHaveBeenCalledTimes(1);
  });

  it('returns an empty package when there is nothing to parse', () => {
    expect(
      mapFeaturePackage({
        subscriptionId,
        metadata: null,
        featureTypeByKey,
        onWarning,
      }),
    ).toStrictEqual([]);
  });
});
