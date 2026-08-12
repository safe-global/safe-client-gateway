// SPDX-License-Identifier: FSL-1.1-MIT
import type {
  FeatureKey,
  FeatureType,
} from '@/modules/entitlements/domain/entities/feature.entity';
import { parseFeaturePackage } from '@/modules/entitlements/domain/feature-package.parser';

const featureTypeByKey: Map<FeatureKey, FeatureType> = new Map([
  ['security_hub', 'binary'],
  ['sso', 'binary'],
  ['pay_from_safe', 'binary'],
  ['safe_seats', 'metered'],
  ['sponsored_transactions', 'metered'],
  ['swap_fee_tier', 'value'],
]);

describe('parseFeaturePackage', () => {
  let onWarning: (message: string) => void;

  beforeEach(() => {
    onWarning = vi.fn<(message: string) => void>();
  });

  it('enables recognized binary plan features', () => {
    const result = parseFeaturePackage({
      metadata: null,
      planFeatures: ['security_hub', 'Priority support', 'SSO '],
      featureTypeByKey,
      onWarning,
    });

    expect(result).toStrictEqual([
      { featureKey: 'security_hub', enabled: true, quota: null, value: null },
      { featureKey: 'sso', enabled: true, quota: null, value: null },
    ]);
    expect(onWarning).not.toHaveBeenCalled();
  });

  it('parses binary, metered, unlimited and value metadata entries', () => {
    const result = parseFeaturePackage({
      metadata: {
        FEATURE_SECURITY_HUB: 'true',
        FEATURE_PAY_FROM_SAFE: 'false',
        FEATURE_SAFE_SEATS: '10',
        FEATURE_SPONSORED_TRANSACTIONS: 'unlimited',
        FEATURE_SWAP_FEE_TIER: 'business',
      },
      planFeatures: [],
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

  it('metadata takes precedence over plan features', () => {
    const result = parseFeaturePackage({
      metadata: { FEATURE_SECURITY_HUB: 'false' },
      planFeatures: ['security_hub'],
      featureTypeByKey,
      onWarning,
    });

    expect(result).toStrictEqual([
      { featureKey: 'security_hub', enabled: false, quota: null, value: null },
    ]);
  });

  it('warns and skips unknown keys, null values and unparseable values', () => {
    const result = parseFeaturePackage({
      metadata: {
        FEATURE_UNKNOWN_THING: 'true',
        FEATURE_SECURITY_HUB: 'yes',
        FEATURE_SAFE_SEATS: 'ten',
        FEATURE_SWAP_FEE_TIER: '',
        FEATURE_SSO: null,
        UNRELATED_KEY: 'ignored silently',
      },
      planFeatures: [],
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
    const result = parseFeaturePackage({
      metadata: { FEATURE_SAFE_SEATS: quota },
      planFeatures: [],
      featureTypeByKey,
      onWarning,
    });

    expect(result).toStrictEqual([]);
    expect(onWarning).toHaveBeenCalledTimes(1);
  });

  it('returns an empty package when there is nothing to parse', () => {
    expect(
      parseFeaturePackage({
        metadata: null,
        planFeatures: [],
        featureTypeByKey,
        onWarning,
      }),
    ).toStrictEqual([]);
  });
});
