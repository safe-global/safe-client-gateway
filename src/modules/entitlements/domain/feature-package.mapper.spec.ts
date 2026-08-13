// SPDX-License-Identifier: FSL-1.1-MIT
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import type { FeatureKey } from '@/modules/entitlements/domain/entities/feature.entity';
import { FeatureType } from '@/modules/entitlements/domain/entities/feature.entity';
import { MAX_ENTITLEMENT_VALUE_LENGTH } from '@/modules/entitlements/domain/entitlements.constants';
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
  let onWarning: (message: string) => void;

  beforeEach(() => {
    onWarning = vi.fn<(message: string) => void>();
  });

  it('parses binary, metered, unlimited and value metadata entries', () => {
    const result = mapFeaturePackage({
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
      metadata: {
        FEATURE_UNKNOWN_THING: 'true',
        FEATURE_SECURITY_HUB: 'yes',
        FEATURE_SAFE_SEATS: 'ten',
        FEATURE_SWAP_FEE_TIER: '',
        FEATURE_SSO: null,
        FEATUER_SAFE_SEATS: '10',
      },
      featureTypeByKey,
      onWarning,
    });

    expect(result).toStrictEqual([]);

    expect(onWarning).toHaveBeenCalledTimes(6);
  });

  // The last two exceed `quota`'s `integer` column: left through, the insert
  // would fail with 22003 and the webhook would be retried until it expires.
  it.each([
    '007',
    '01',
    '1.5',
    '-1',
    '1e3',
    `${DB_MAX_SAFE_INTEGER + 1}`,
    '99999999999',
  ])('warns and skips the unusable metered quota %s', (quota) => {
    const result = mapFeaturePackage({
      metadata: { FEATURE_SAFE_SEATS: quota },
      featureTypeByKey,
      onWarning,
    });

    expect(result).toStrictEqual([]);
    expect(onWarning).toHaveBeenCalledTimes(1);
  });

  it('accepts the largest quota the column can hold', () => {
    const result = mapFeaturePackage({
      metadata: { FEATURE_SAFE_SEATS: `${DB_MAX_SAFE_INTEGER}` },
      featureTypeByKey,
      onWarning,
    });

    expect(result).toStrictEqual([
      {
        featureKey: 'safe_seats',
        enabled: true,
        quota: DB_MAX_SAFE_INTEGER,
        value: null,
      },
    ]);
    expect(onWarning).not.toHaveBeenCalled();
  });

  // Beyond `value`'s `varchar(255)`, so the insert would fail with 22001.
  it('warns and skips a value longer than the column allows', () => {
    const result = mapFeaturePackage({
      metadata: {
        FEATURE_SWAP_FEE_TIER: 'a'.repeat(MAX_ENTITLEMENT_VALUE_LENGTH + 1),
      },
      featureTypeByKey,
      onWarning,
    });

    expect(result).toStrictEqual([]);
    expect(onWarning).toHaveBeenCalledTimes(1);
  });

  it('accepts the longest value the column can hold', () => {
    const value = 'a'.repeat(MAX_ENTITLEMENT_VALUE_LENGTH);

    expect(
      mapFeaturePackage({
        metadata: { FEATURE_SWAP_FEE_TIER: value },
        featureTypeByKey,
        onWarning,
      }),
    ).toStrictEqual([
      { featureKey: 'swap_fee_tier', enabled: true, quota: null, value },
    ]);
    expect(onWarning).not.toHaveBeenCalled();
  });

  it('returns an empty package when there is nothing to parse', () => {
    expect(
      mapFeaturePackage({
        metadata: null,
        featureTypeByKey,
        onWarning,
      }),
    ).toStrictEqual([]);
  });
});
