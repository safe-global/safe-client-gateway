// SPDX-License-Identifier: FSL-1.1-MIT
/**
 * Backfills user email encryption over existing rows.
 *
 * Each user's plaintext email is encrypted directly by KMS (bound to the user
 * via the KMS encryption context) and gets a blind index in
 * `users.email_index` for uniqueness and lookups. The blind index cannot be
 * computed in SQL, so this cannot be a pure SQL migration.
 *
 * With encryption enabled, reads REQUIRE ciphertext — a plaintext row is a
 * hard error. The backfill therefore runs BEFORE the service fleet is
 * switched over: deploy the code and column migrations (fleet still running
 * with SPACES_FIELD_ENCRYPTION_ENABLED=false), then run this script with the
 * flag enabled in its own environment:
 *
 *   SPACES_FIELD_ENCRYPTION_ENABLED=true \
 *   SPACES_FIELD_ENCRYPTION_INDEX_KEY=... \
 *   AWS_KMS_ENCRYPTION_KEY_ID=... AWS_REGION=... \
 *     ts-node scripts/backfill-user-email-encryption.ts [--verify] [--dry-run]
 *
 *   --dry-run  Report how many rows still hold plaintext; write nothing.
 *   --verify   Assert no plaintext remains; exit non-zero if any does.
 *
 * Rows written by the still-disabled fleet between the backfill and the flag
 * flip remain plaintext, so flip SPACES_FIELD_ENCRYPTION_ENABLED=true on the
 * fleet immediately after the backfill and re-run the script until --verify
 * passes; until then, reads of such stragglers fail.
 *
 * Notes:
 * - Idempotent: rows already in `kms:` form are skipped (a validated email can
 *   never start with 'kms:').
 * - Each row costs one KMS Encrypt call — budget KMS rate limits accordingly.
 * - `updated_at` is preserved by disabling user triggers within each batch
 *   transaction. This requires the connecting role to own the table (or be
 *   superuser). Always rehearse on a staging copy before running in production.
 *
 * SEARCHABLE-FIELD CAVEAT: users.email is encrypted non-deterministically;
 * uniqueness and equality lookups use the `email_index` blind index once
 * encryption is enabled, and the plaintext `email` column while it is
 * disabled. During the window between this backfill and the fleet-wide flag
 * flip, plaintext lookups on the still-disabled fleet will not match
 * already-backfilled rows (and vice versa afterwards for straggler rows).
 * Run the backfill and the flag flip back-to-back in a low-traffic window; if
 * a zero-gap transition is required, add dual-read (query plaintext `email`
 * and the blind index) to the email lookups for the duration.
 */
import { DataSource } from 'typeorm';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { KmsService } from '@/datasources/kms/kms.service';
import { EmailEncryptionService } from '@/modules/users/domain/email-encryption.service';

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
  emailEncryption: EmailEncryptionService,
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
        const emailIndex = emailEncryption.blindIndex(row.email);
        const encrypted = await emailEncryption.encrypt(row.id, row.email);
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

  const emailEncryption = new EmailEncryptionService(
    configurationService,
    new KmsService(configurationService),
  );
  await emailEncryption.onModuleInit();

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
          `${remaining} plaintext values remain; reads will fail while field encryption is enabled`,
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
    await backfillUserEmails(dataSource, emailEncryption);

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
