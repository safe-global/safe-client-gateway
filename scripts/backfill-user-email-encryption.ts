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
 * with SPACES_FIELD_ENCRYPTION_ENABLED=false), then run this script:
 *
 *   SPACES_FIELD_ENCRYPTION_INDEX_KEY=... \
 *   AWS_KMS_ENCRYPTION_KEY_ID=... AWS_REGION=... \
 *     ts-node scripts/backfill-user-email-encryption.ts [--verify] [--dry-run]
 *
 *   --dry-run  Report how many rows still hold plaintext; write nothing.
 *   --verify   Assert no plaintext remains; exit non-zero if any does.
 *
 * This script always encrypts via KMS — it forces field encryption on for
 * itself regardless of SPACES_FIELD_ENCRYPTION_ENABLED, so it doesn't matter
 * whether the fleet has the flag on or off when it runs (that env var is
 * irrelevant here; don't bother setting it for this command). Rows written
 * by the still-disabled fleet between the backfill and the flag flip remain
 * plaintext, so flip SPACES_FIELD_ENCRYPTION_ENABLED=true on the fleet
 * immediately after the backfill and re-run this same command until --verify
 * passes (it will pick up and encrypt any stragglers); until then, reads of
 * such stragglers fail on the now-enabled fleet.
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
import { AwsKmsService } from '@/datasources/kms/aws-kms.service';
import {
  FIELD_ENCRYPTION_PREFIX,
  FIELD_ENCRYPTION_VERSION,
} from '@/datasources/kms/field-crypto.constants';
import { FieldCryptoService } from '@/datasources/kms/field-crypto.service';
import { EmailEncryptionService } from '@/modules/users/domain/email-encryption.service';

const BATCH_SIZE = 500;
// Bounds concurrent KMS Encrypt calls per batch; KMS comfortably handles this,
// and the DB connection is untouched until the (serial) write phase below.
const ENCRYPT_CONCURRENCY = 20;
// The exact on-disk prefix of an already-encrypted value. Matching only this
// (rather than the looser 'kms:%') means a malformed 'kms:'-prefixed value
// can't be mistaken for done: it stays visible to both the batch SELECT below
// and countPlaintext's --verify check.
const ENCRYPTED_PREFIX = `${FIELD_ENCRYPTION_PREFIX}:${FIELD_ENCRYPTION_VERSION}:`;

/** Runs `fn` over `items` with at most `concurrency` calls in flight. */
async function mapWithConcurrency<T, R>(
  items: Array<T>,
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<Array<R>> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) {
          return;
        }
        results[i] = await fn(items[i]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

interface DurationStats {
  count: number;
  minMs: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
}

function summarize(durationsMs: Array<number>): DurationStats {
  if (durationsMs.length === 0) {
    return { count: 0, minMs: 0, meanMs: 0, p50Ms: 0, p95Ms: 0, maxMs: 0 };
  }
  const sorted = [...durationsMs].sort((a, b) => a - b);
  const percentile = (p: number): number =>
    sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  return {
    count: sorted.length,
    minMs: sorted[0],
    meanMs: sorted.reduce((sum, ms) => sum + ms, 0) / sorted.length,
    p50Ms: percentile(50),
    p95Ms: percentile(95),
    maxMs: sorted[sorted.length - 1],
  };
}

function formatStats(label: string, stats: DurationStats): string {
  if (stats.count === 0) {
    return `  ${label}: no samples`;
  }
  return (
    `  ${label}: count=${stats.count} min=${stats.minMs.toFixed(1)}ms ` +
    `mean=${stats.meanMs.toFixed(1)}ms p50=${stats.p50Ms.toFixed(1)}ms ` +
    `p95=${stats.p95Ms.toFixed(1)}ms max=${stats.maxMs.toFixed(1)}ms`
  );
}

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

/**
 * Reads the resolved configuration object by dotted key, like the app does.
 *
 * Forces `spaces.fieldEncryption.enabled` on regardless of
 * SPACES_FIELD_ENCRYPTION_ENABLED: this script's whole job is to produce
 * ciphertext, including when run before the fleet-wide flag flip (see the
 * file docstring), so EmailEncryptionService.encrypt must never take the
 * disabled/passthrough branch here. This also means onModuleInit will
 * require SPACES_FIELD_ENCRYPTION_INDEX_KEY to be set, which the backfill
 * needs anyway to compute a real blind index.
 */
function buildConfigurationService(): IConfigurationService {
  const config = configuration();
  config.spaces.fieldEncryption.enabled = true;
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
  const runStartedAt = process.hrtime.bigint();
  const encryptDurationsMs: Array<number> = [];
  const batchWriteDurationsMs: Array<number> = [];

  while (true) {
    // A blank email can never be encrypted (KMS rejects zero-length
    // plaintext) and is not a value the app ever writes (email is nullable,
    // not blank) — it's invalid data, excluded here so it can't crash the
    // batch or get re-selected forever. It still shows up in countPlaintext.
    const rows = await dataSource.query<Array<{ id: number; email: string }>>(
      `SELECT id, email FROM "users"
       WHERE email IS NOT NULL AND email <> '' AND email NOT LIKE '${ENCRYPTED_PREFIX}%'
       LIMIT $1`,
      [BATCH_SIZE],
    );
    if (rows.length === 0) {
      break;
    }

    // Encrypt is a KMS network round-trip and independent per row — do it
    // concurrently, outside the transaction, so DISABLE TRIGGER doesn't hold
    // for the sum of every row's KMS latency.
    const encryptedRows = await mapWithConcurrency(
      rows,
      ENCRYPT_CONCURRENCY,
      async (row) => {
        const encryptStartedAt = process.hrtime.bigint();
        const encrypted = await emailEncryption.encrypt(row.id, row.email);
        encryptDurationsMs.push(
          Number(process.hrtime.bigint() - encryptStartedAt) / 1e6,
        );
        return {
          id: row.id,
          emailIndex: emailEncryption.blindIndex(row.email),
          encrypted,
        };
      },
    );

    const batchWriteStartedAt = process.hrtime.bigint();
    await dataSource.transaction(async (manager) => {
      await manager.query(`ALTER TABLE "users" DISABLE TRIGGER USER`);
      for (const row of encryptedRows) {
        await manager.query(
          `UPDATE "users"
           SET email = $1, email_index = $2
           WHERE id = $3`,
          [row.encrypted, row.emailIndex, row.id],
        );
      }
      await manager.query(`ALTER TABLE "users" ENABLE TRIGGER USER`);
    });
    batchWriteDurationsMs.push(
      Number(process.hrtime.bigint() - batchWriteStartedAt) / 1e6,
    );

    updated += rows.length;
    process.stdout.write(`  users.email: ${updated} encrypted\r`);
  }

  console.info(`  users.email: ${updated} encrypted`);

  if (updated > 0) {
    const totalSeconds = Number(process.hrtime.bigint() - runStartedAt) / 1e9;
    console.info('Benchmark:');
    console.info(
      `  total: ${totalSeconds.toFixed(1)}s for ${updated} rows ` +
        `(${(updated / totalSeconds).toFixed(1)} rows/sec)`,
    );
    console.info(
      formatStats('kms encrypt latency', summarize(encryptDurationsMs)),
    );
    console.info(
      formatStats('batch write duration', summarize(batchWriteDurationsMs)),
    );
  }

  return updated;
}

async function countPlaintext(dataSource: DataSource): Promise<number> {
  // A user with an email but no blind index has not been backfilled.
  const [{ count }] = await dataSource.query<Array<{ count: string }>>(
    `SELECT COUNT(*)::int AS count FROM "users"
     WHERE email IS NOT NULL AND (email NOT LIKE '${ENCRYPTED_PREFIX}%' OR email_index IS NULL)`,
  );
  const remaining = Number(count);
  if (remaining > 0) {
    console.info(`  users.email: ${remaining} plaintext/unindexed remaining`);
  }

  // Called out separately: these are skipped by backfillUserEmails (KMS
  // can't encrypt zero-length plaintext) and re-running the backfill will
  // never clear them — they need a manual data fix (e.g. set to NULL).
  const [{ count: blankCount }] = await dataSource.query<
    Array<{ count: string }>
  >(`SELECT COUNT(*)::int AS count FROM "users" WHERE email = ''`);
  const blank = Number(blankCount);
  if (blank > 0) {
    console.info(
      `  users.email: ${blank} row(s) have a blank email — invalid data ` +
        `that the backfill cannot encrypt; fix manually (e.g. set to NULL) ` +
        `before --verify can pass`,
    );
  }

  return remaining;
}

async function main(): Promise<void> {
  const verify = process.argv.includes('--verify');
  const dryRun = process.argv.includes('--dry-run');

  const configurationService = buildConfigurationService();
  const config = configuration();

  const fieldCrypto = new FieldCryptoService(
    configurationService,
    new AwsKmsService(configurationService),
  );
  await fieldCrypto.onModuleInit();
  const emailEncryption = new EmailEncryptionService(fieldCrypto);

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
