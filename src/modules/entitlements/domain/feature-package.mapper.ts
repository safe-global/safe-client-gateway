// SPDX-License-Identifier: FSL-1.1-MIT
import type { StripeMetadata } from '@/datasources/billing-api/entities/metadata.entity';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { FeatureType } from '@/modules/entitlements/domain/entities/feature.entity';
import type { ParsedEntitlement } from '@/modules/entitlements/domain/entities/materialized-subscription.entity';
import {
  FEATURE_METADATA_PREFIX,
  MAX_ENTITLEMENT_VALUE_LENGTH,
  SAFE_SEATS_METADATA_KEY,
  UNLIMITED_METADATA_VALUE,
} from '@/modules/entitlements/domain/entitlements.constants';
import { NonNegativeNumericStringSchema } from '@/validation/entities/schemas/non-negative-numeric-string.schema';

/** A metered quota the `quota` `integer` column can actually hold. */
const QuotaSchema = NonNegativeNumericStringSchema.refine(
  (value) => Number(value) <= DB_MAX_SAFE_INTEGER,
);

/**
 * `value` as a metered quota, or `null` when it is not one — `unlimited` is
 * handled by each caller, since one keeps an entry for it and the other
 * doesn't; this only covers the numeric-or-not half both share.
 */
function parseQuotaValue(value: string): number | null {
  return QuotaSchema.safeParse(value).success ? Number(value) : null;
}

export function hasFeaturePackageMetadata(
  metadata: StripeMetadata | null | undefined,
): boolean {
  return Object.keys(metadata ?? {}).some((key) =>
    key.startsWith(FEATURE_METADATA_PREFIX),
  );
}

/**
 * The plan's Safe seat quota from its `FEATURE_SAFE_SEATS` metadata, ahead of
 * a subscription change — before a webhook would otherwise materialize it.
 * `null` covers unlimited and absent alike: neither bounds the seat count, so
 * neither blocks a caller comparing against it. A malformed value is also
 * treated as unbounded, but reported through `onWarning` rather than passed
 * over in silence — unlike `unlimited`, it is not a value anyone intended.
 */
export function parseSafeSeatQuota(
  metadata: StripeMetadata | null | undefined,
  onWarning?: (message: string) => void,
): number | null {
  const raw = metadata?.[SAFE_SEATS_METADATA_KEY];
  if (raw == null) {
    return null;
  }
  const value = raw.trim();
  if (value.toLowerCase() === UNLIMITED_METADATA_VALUE) {
    return null;
  }
  const quota = parseQuotaValue(value);
  if (quota === null) {
    onWarning?.(`Invalid ${SAFE_SEATS_METADATA_KEY} value: ${raw}`);
  }
  return quota;
}

/**
 * Maps a subscription's `FEATURE_*` metadata strings — raw, untyped upstream
 * data — to typed `ParsedEntitlement` rows, resolving each key's type against
 * the feature catalog (`featureTypeByKey`). The metadata is the only source of
 * a purchased package; a plan's own feature list never grants entitlements.
 * Unknown `FEATURE_*` keys and undecodable values are reported via `onWarning`
 * and skipped — a malformed entry must never fail the webhook. Keys without
 * the prefix belong to someone else (`planName`, upstream bookkeeping) and are
 * passed over silently.
 */
export function mapFeaturePackage(args: {
  metadata: StripeMetadata | null | undefined;
  featureTypeByKey: Map<string, FeatureType>;
  onWarning: (message: string) => void;
}): Array<ParsedEntitlement> {
  const packageByKey = new Map<string, ParsedEntitlement>();

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
        const quota = parseQuotaValue(value);
        if (quota === null) {
          args.onWarning(
            `Invalid metered value for ${metadataKey}: ${rawValue}`,
          );
          continue;
        }
        packageByKey.set(key, {
          featureKey: key,
          enabled: true,
          quota,
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
