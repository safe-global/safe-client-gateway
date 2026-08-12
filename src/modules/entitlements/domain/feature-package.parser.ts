// SPDX-License-Identifier: FSL-1.1-MIT
import type { StripeMetadata } from '@/datasources/billing-api/entities/metadata.entity';
import type {
  FeatureKey,
  FeatureType,
} from '@/modules/entitlements/domain/entities/feature.entity';
import type { ParsedEntitlement } from '@/modules/entitlements/domain/entities/materialized-subscription.entity';
import {
  FEATURE_METADATA_PREFIX,
  UNLIMITED_METADATA_VALUE,
} from '@/modules/entitlements/domain/entitlements.constants';
import { NonNegativeNumericStringSchema } from '@/validation/entities/schemas/non-negative-numeric-string.schema';

/**
 * Parses a subscription's purchased feature package.
 *
 * Sources, in increasing precedence:
 * 1. `plan.features` entries matching a catalog key enable binary features.
 * 2. `FEATURE_<UPPERCASED_KEY>` metadata entries, parsed by the feature's
 *    type: binary → `true`/`false`, metered → integer or `unlimited`
 *    (= `quota: null`), value → verbatim string.
 *
 * The feature's type is a fact about the catalog (the `features` table), not
 * something this function knows statically — the caller passes it in
 * (`featureTypeByKey`, read via `IFeaturesRepository.getFeatures()`), so a new
 * catalog row needs no code change here.
 *
 * Unknown keys or unparseable values are reported via `onWarning` and
 * skipped — a malformed entry must never fail the webhook. Catalog features
 * absent from the package get no row; the read path falls back to the Free
 * defaults for them.
 */
export function parseFeaturePackage(args: {
  metadata: StripeMetadata | null | undefined;
  planFeatures: Array<string>;
  featureTypeByKey: Map<FeatureKey, FeatureType>;
  onWarning: (message: string) => void;
}): Array<ParsedEntitlement> {
  const packageByKey = new Map<FeatureKey, ParsedEntitlement>();

  for (const planFeature of args.planFeatures) {
    const key = planFeature.trim().toLowerCase();
    if (args.featureTypeByKey.get(key) === 'binary') {
      packageByKey.set(key, {
        featureKey: key,
        enabled: true,
        quota: null,
        value: null,
      });
    }
  }

  for (const [metadataKey, rawValue] of Object.entries(args.metadata ?? {})) {
    if (!metadataKey.startsWith(FEATURE_METADATA_PREFIX)) {
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
      case 'binary': {
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
      case 'metered': {
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
      case 'value': {
        if (value.length === 0) {
          args.onWarning(`Empty value for ${metadataKey}`);
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
