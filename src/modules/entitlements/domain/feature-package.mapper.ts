// SPDX-License-Identifier: FSL-1.1-MIT
import type { StripeMetadata } from '@/datasources/billing-api/entities/metadata.entity';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import type { FeatureKey } from '@/modules/entitlements/domain/entities/feature.entity';
import { FeatureType } from '@/modules/entitlements/domain/entities/feature.entity';
import type { ParsedEntitlement } from '@/modules/entitlements/domain/entities/materialized-subscription.entity';
import {
  FEATURE_METADATA_PREFIX,
  MAX_ENTITLEMENT_VALUE_LENGTH,
  UNLIMITED_METADATA_VALUE,
} from '@/modules/entitlements/domain/entitlements.constants';
import { NonNegativeNumericStringSchema } from '@/validation/entities/schemas/non-negative-numeric-string.schema';

/** A metered quota the `quota` `integer` column can actually hold. */
const QuotaSchema = NonNegativeNumericStringSchema.refine(
  (value) => Number(value) <= DB_MAX_SAFE_INTEGER,
);

/**
 * Maps a subscription's `FEATURE_*` metadata strings — raw, untyped upstream
 * data — to typed `ParsedEntitlement` rows, resolving each key's type against
 * the feature catalog (`featureTypeByKey`). The metadata is the only source of
 * a purchased package; a plan's own feature list never grants entitlements.
 * Unknown keys and undecodable values are reported via `onWarning` and skipped
 * — a malformed entry must never fail the webhook.
 */
export function mapFeaturePackage(args: {
  metadata: StripeMetadata | null | undefined;
  featureTypeByKey: Map<FeatureKey, FeatureType>;
  onWarning: (message: string) => void;
}): Array<ParsedEntitlement> {
  const packageByKey = new Map<FeatureKey, ParsedEntitlement>();

  for (const [metadataKey, rawValue] of Object.entries(args.metadata ?? {})) {
    if (!metadataKey.startsWith(FEATURE_METADATA_PREFIX)) {
      args.onWarning(`Unrecognized metadata key: ${metadataKey}`);
      continue;
    }
    const key = metadataKey.slice(FEATURE_METADATA_PREFIX.length).toLowerCase();
    const type = args.featureTypeByKey.get(key);
    if (type === undefined) {
      args.onWarning(`Unknown feature metadata key: ${metadataKey}`);
      continue;
    }
    if (rawValue == null) {
      args.onWarning(`Missing value for feature metadata key: ${metadataKey}`);
      continue;
    }
    const value = rawValue.trim();

    switch (type) {
      case FeatureType.Binary: {
        if (value !== 'true' && value !== 'false') {
          args.onWarning(
            `Invalid binary value for ${metadataKey}: ${rawValue}`,
          );
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
        if (!QuotaSchema.safeParse(value).success) {
          args.onWarning(
            `Invalid metered value for ${metadataKey}: ${rawValue}`,
          );
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
        if (value.length === 0 || value.length > MAX_ENTITLEMENT_VALUE_LENGTH) {
          args.onWarning(`Invalid value for ${metadataKey}`);
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
