// SPDX-License-Identifier: FSL-1.1-MIT
import { parseFeaturePackage } from '@/modules/entitlements/domain/feature-package.parser';

describe('parseFeaturePackage', () => {
  let onWarning: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onWarning = vi.fn();
  });

  it('enables recognized binary plan features', () => {
    const result = parseFeaturePackage({
      metadata: null,
      planFeatures: ['security_hub', 'Priority support', 'SSO '],
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
      onWarning,
    });

    expect(result).toStrictEqual([]);
    expect(onWarning).toHaveBeenCalledTimes(5);
  });

  it('returns an empty package when there is nothing to parse', () => {
    expect(
      parseFeaturePackage({ metadata: null, planFeatures: [], onWarning }),
    ).toStrictEqual([]);
  });
});
