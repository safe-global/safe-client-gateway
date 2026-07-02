// SPDX-License-Identifier: FSL-1.1-MIT
/**
 * Backfills user email encryption over existing rows.
 *
 * Each user's plaintext email is encrypted directly by KMS (bound to the user
 * via the KMS encryption context) and gets a blind index in
 * `users.email_index` for uniqueness and lookups. The blind index cannot be
 * computed in SQL, so this cannot be a pure SQL migration.
 *
 * Run AFTER deploying the code, running the column migrations, and enabling
 * encrypted writes with legacy plaintext reads still allowed:
 *
 *   SPACES_FIELD_ENCRYPTION_ENABLED=true \
 *   SPACES_FIELD_ENCRYPTION_ALLOW_LEGACY_PLAINTEXT=true \
 *   SPACES_FIELD_ENCRYPTION_INDEX_KEY=... \
 *   AWS_KMS_ENCRYPTION_KEY_ID=... AWS_REGION=... \
 *     ts-node scripts/backfill-user-email-encryption.ts [--verify] [--dry-run]
 *
 *   --dry-run  Report how many rows still hold plaintext; write nothing.
 *   --verify   Assert no plaintext remains; exit non-zero if any does.
 *
 * Notes:
 * - Idempotent: rows already in `kms:` form are skipped (a validated email can
 *   never start with 'kms:').
 * - Each row costs one KMS Encrypt call — budget KMS rate limits accordingly.
 * - `updated_at` is preserved by disabling user triggers within each batch
 *   transaction. This requires the connecting role to own the table (or be
 *   superuser). Always rehearse on a staging copy before running in production.
 *
 * Once this reports zero plaintext remaining, set
 * SPACES_FIELD_ENCRYPTION_ALLOW_LEGACY_PLAINTEXT=false.
 *
 * SEARCHABLE-FIELD CAVEAT: users.email is encrypted non-deterministically;
 * uniqueness and equality lookups use the `email_index` blind index. Once
 * encryption is enabled, lookups match only rows whose `email_index` is
 * populated. Run this backfill promptly after enabling (or during a
 * low-traffic window): between enabling and backfill completing, a lookup for
 * a not-yet-backfilled user's email will not match. If a zero-gap transition
 * is required, add dual-read (query plaintext `email` and the blind index) to
 * the email lookups for the duration of the backfill.
 */
import { DataSource } from 'typeorm';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { KmsService } from '@/datasources/kms/kms.service';

const BATCH_SIZE = 500;

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

async function backfillUserEmails(
  dataSource: DataSource,
  kmsService: KmsService,
): Promise<number> {
  let updated = 0;

  for (;;) {
    const rows = await dataSource.query<Array<{ id: number; email: string }>>(
      `SELECT id, email FROM "users"
       WHERE email IS NOT NULL AND email NOT LIKE 'kms:%'
       LIMIT $1`,
      [BATCH_SIZE],
    );
    if (rows.length === 0) {
      break;
    }

    await dataSource.transaction(async (manager) => {
      await manager.query(`ALTER TABLE "users" DISABLE TRIGGER USER`);
      for (const row of rows) {
        const emailIndex = kmsService.blindIndex(row.email);
        const encrypted = await kmsService.encrypt(row.id, row.email);
        await manager.query(
          `UPDATE "users"
           SET email = $1, email_index = $2
           WHERE id = $3`,
          [encrypted, emailIndex, row.id],
        );
      }
      await manager.query(`ALTER TABLE "users" ENABLE TRIGGER USER`);
    });

    updated += rows.length;
    process.stdout.write(`  users.email: ${updated} encrypted\r`);
  }

  console.info(`  users.email: ${updated} encrypted`);
  return updated;
}

async function countPlaintext(dataSource: DataSource): Promise<number> {
  // A user with an email but no blind index has not been backfilled.
  const [{ count }] = await dataSource.query<Array<{ count: string }>>(
    `SELECT COUNT(*)::int AS count FROM "users"
     WHERE email IS NOT NULL AND (email NOT LIKE 'kms:%' OR email_index IS NULL)`,
  );
  const remaining = Number(count);
  if (remaining > 0) {
    console.info(`  users.email: ${remaining} plaintext/unindexed remaining`);
  }
  return remaining;
}

async function main(): Promise<void> {
  const verify = process.argv.includes('--verify');
  const dryRun = process.argv.includes('--dry-run');

  const configurationService = buildConfigurationService();
  const config = configuration();

  const kmsService = new KmsService(configurationService);
  await kmsService.onModuleInit();

  const dataSource = new DataSource({
    ...postgresConfig({
      ...config.db.connection.postgres,
      type: 'postgres',
    }),
  });
  await dataSource.initialize();

  try {
    if (verify || dryRun) {
      console.info(verify ? 'Verifying...' : 'Dry run...');
      const remaining = await countPlaintext(dataSource);
      console.info(`Total plaintext remaining: ${remaining}`);
      if (verify && remaining > 0) {
        throw new Error(
          `${remaining} plaintext values remain; not safe to disable legacy plaintext reads`,
        );
      }
      return;
    }

    // With encryption disabled, encrypt() passes plaintext through and the
    // batch loop would never terminate — refuse to run instead.
    if (
      !configurationService.getOrThrow<boolean>(
        'spaces.fieldEncryption.enabled',
      )
    ) {
      throw new Error(
        'SPACES_FIELD_ENCRYPTION_ENABLED must be true to backfill',
      );
    }

    console.info('Backfilling user emails...');
    await backfillUserEmails(dataSource, kmsService);

    const remaining = await countPlaintext(dataSource);
    console.info(`Done. Plaintext remaining: ${remaining}`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
