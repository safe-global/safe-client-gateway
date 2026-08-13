// SPDX-License-Identifier: FSL-1.1-MIT
import type { StripeMetadata } from '@/datasources/billing-api/entities/metadata.entity';
import type { FeatureKey } from '@/modules/entitlements/domain/entities/feature.entity';
import { FeatureType } from '@/modules/entitlements/domain/entities/feature.entity';
import type { ParsedEntitlement } from '@/modules/entitlements/domain/entities/materialized-subscription.entity';
import {
  FEATURE_METADATA_PREFIX,
  UNLIMITED_METADATA_VALUE,
} from '@/modules/entitlements/domain/entitlements.constants';
import { NonNegativeNumericStringSchema } from '@/validation/entities/schemas/non-negative-numeric-string.schema';

/**
 * Maps a subscription's `FEATURE_*` metadata strings — raw, untyped upstream
 * data — to typed `ParsedEntitlement` rows, resolving each key's type against
 * the feature catalog (`featureTypeByKey`). The metadata is the only source of
 * a purchased package; a plan's own feature list never grants entitlements.
 * Unknown keys and undecodable values are reported via `onWarning` and skipped
 * — a malformed entry must never fail the webhook.
 */
export function mapFeaturePackage(args: {
  subscriptionId: string;
  metadata: StripeMetadata | null | undefined;
  featureTypeByKey: Map<FeatureKey, FeatureType>;
  onWarning: (message: string) => void;
}): Array<ParsedEntitlement> {
  const packageByKey = new Map<FeatureKey, ParsedEntitlement>();
  const warn = (message: string): void =>
    args.onWarning(
      `Feature package of subscription ${args.subscriptionId}: ${message}`,
    );

  for (const [metadataKey, rawValue] of Object.entries(args.metadata ?? {})) {
    if (!metadataKey.startsWith(FEATURE_METADATA_PREFIX)) {
      continue;
    }
    const key = metadataKey.slice(FEATURE_METADATA_PREFIX.length).toLowerCase();
    const type = args.featureTypeByKey.get(key);
    if (type === undefined) {
      warn(`Unknown feature metadata key: ${metadataKey}`);
      continue;
    }
    if (rawValue == null) {
      warn(`Missing value for feature metadata key: ${metadataKey}`);
      continue;
    }
    const value = rawValue.trim();

    switch (type) {
      case FeatureType.Binary: {
        if (value !== 'true' && value !== 'false') {
          warn(`Invalid binary value for ${metadataKey}: ${rawValue}`);
          continue;
        }
        packageByKey.set(key, {
          featureKey: key,
          enabled: value === 'true',
          quota: null,
          value: null,
        });
        break;
      }
      case FeatureType.Metered: {
        if (value.toLowerCase() === UNLIMITED_METADATA_VALUE) {
          packageByKey.set(key, {
            featureKey: key,
            enabled: true,
            quota: null,
            value: null,
          });
          continue;
        }
        if (!NonNegativeNumericStringSchema.safeParse(value).success) {
          warn(`Invalid metered value for ${metadataKey}: ${rawValue}`);
          continue;
        }
        packageByKey.set(key, {
          featureKey: key,
          enabled: true,
          quota: Number(value),
          value: null,
        });
        break;
      }
      case FeatureType.Value: {
        if (value.length === 0) {
          warn(`Empty value for ${metadataKey}`);
          continue;
        }
        packageByKey.set(key, {
          featureKey: key,
          enabled: true,
          quota: null,
          value,
        });
        break;
      }
    }
  }

  return [...packageByKey.values()];
}
