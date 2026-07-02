// SPDX-License-Identifier: FSL-1.1-MIT
/**
 * Generates the KMS-wrapped key for the users.email blind index.
 *
 * KMS protects the key; the app unwraps it once at boot and performs local
 * HMAC computation with it. This script prints the *encrypted* key (safe to
 * store in config). The plaintext key material is zeroed and never printed.
 *
 * Usage (credentials via AWS_WEB_IDENTITY_TOKEN_FILE, or AWS_ACCESS_KEY_ID
 * and AWS_SECRET_ACCESS_KEY):
 *   AWS_KMS_ENCRYPTION_KEY_ID=<arn-or-id> AWS_REGION=<region> \
 *     yarn generate:field-encryption-key
 *
 * Outputs the value to set (initial setup):
 *   SPACES_FIELD_ENCRYPTION_INDEX_KEY
 *
 * ROTATION CAVEAT: the blind index is an HMAC under this single key; nothing
 * verifies against older keys. Once indexes are stored, repointing
 * SPACES_FIELD_ENCRYPTION_INDEX_KEY at a new key silently orphans every
 * existing users.email_index (lookups stop matching and the unique index
 * stops colliding). Changing the index key requires recomputing every stored
 * index — the regular backfill will NOT do this, as it skips rows whose email
 * is already encrypted.
 */
import type { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/configuration';
import { KmsService } from '@/datasources/kms/kms.service';

function getByPath(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === 'object'
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      obj,
    );
}

/** Reads the resolved configuration object by dotted key, like the app does. */
function buildConfigurationService(): IConfigurationService {
  const config = configuration();
  return {
    getOrThrow: <T>(key: string): T => {
      const value = getByPath(config, key);
      if (value === undefined || value === null) {
        throw new Error(`Missing required configuration: ${key}`);
      }
      return value as T;
    },
    get: <T>(key: string): T | undefined => getByPath(config, key) as T,
  };
}

async function main(): Promise<void> {
  const kmsService = new KmsService(buildConfigurationService());
  const { plaintext, encrypted } = await kmsService.generateDataKey();

  // Zero out the plaintext key material as soon as possible; we must never
  // print or persist it.
  plaintext.fill(0);

  console.info(
    [
      '',
      'Generated a new KMS-wrapped blind-index key. For initial setup, set the following in your environment:',
      '',
      `SPACES_FIELD_ENCRYPTION_INDEX_KEY=${encrypted.toString('base64')}`,
      '',
      'If blind indexes are already stored, do NOT repoint SPACES_FIELD_ENCRYPTION_INDEX_KEY',
      'at this key: indexes are verified only under the configured key, so existing',
      'users.email_index values would silently stop matching. Changing the index key',
      'requires recomputing every stored index first.',
      '',
    ].join('\n'),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
