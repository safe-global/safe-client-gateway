// SPDX-License-Identifier: FSL-1.1-MIT
/**
 * Backfills KMS field encryption over existing rows of every encrypted field.
 *
 * Tables and fields, in run order:
 *
 *   users.email                       + email_index
 *   wallets.address                   + address_index
 *   spaces.name
 *   space_safes.address               + address_index
 *   space_address_book_items.address  + address_index
 *   space_address_book_items.name
 *   address_book_requests.address     + address_index
 *   address_book_requests.name
 *   members.name, members.alias
 *   space_audit_log.payload           (whole payload as one blob)
 *
 * Each plaintext value is encrypted directly by KMS, bound to its owner via
 * the KMS encryption context ({ userId } for users/wallets, { spaceId } for
 * everything else). Searchable address columns also get a blind index; blind
 * indexes cannot be computed in SQL, so this cannot be a pure SQL migration.
 *
 * Release choreography (2026-07-10 expansion spec): there is NO transitional
 * read tolerance — while ENCRYPTION_ENABLED is on, a plaintext value read is a
 * hard error (KmsEncryptionService.decrypt throws; the repositories match
 * encrypted rows on the blind index alone). So the backfill MUST complete
 * before the flag flips, not after:
 *
 *   1. Deploy the code with encryption disabled.
 *   2. Run both column migrations.
 *   3. Run this script until --verify exits 0. The fleet is still writing
 *      plaintext at this point, so a single pass will leave stragglers behind;
 *      re-run the same command until --verify passes (this script forces
 *      encryption on for itself regardless of the fleet flag, so its output is
 *      always ciphertext even while the fleet flag is off).
 *   4. Flip ENCRYPTION_ENABLED on. From here new writes encrypt and every read
 *      expects ciphertext.
 *
 *   ENCRYPTION_INDEX_KEY=... \
 *   AWS_KMS_ENCRYPTION_KEY_ID=... AWS_REGION=... \
 *     ts-node scripts/backfill-field-encryption.ts [--verify] [--dry-run]
 *
 *   --dry-run  Report how many rows still hold plaintext, per table; write
 *              nothing.
 *   --verify   Assert no plaintext remains anywhere; exit non-zero if any
 *              table still has plaintext.
 *
 * Race window between step 3 and step 4: because the still-disabled fleet keeps
 * writing plaintext, a row can land AFTER --verify passes but BEFORE the flag
 * flips, and that row would be an unreadable hard error the instant the flag is
 * on. Close the window at flip time — freeze writes (or drain/deploy the
 * encrypting build) across the flip, and run one more `--verify` immediately
 * before flipping, rolling back the flag if it exits non-zero. Do NOT flip on
 * the strength of an earlier --verify pass alone.
 *
 * Notes:
 * - Idempotent: values already in the encrypted form (the `ENCRYPTED_PREFIX`
 *   constant, `kms:v1:`) are skipped. Matching the exact prefix (rather than
 *   the looser 'kms:%') means a malformed 'kms:'-prefixed value can't be
 *   mistaken for done: it stays visible to the batch SELECTs and --verify, and
 *   gets encrypted as an opaque string.
 * - Each value costs one KMS Encrypt call — budget KMS rate limits.
 * - `updated_at` is preserved by disabling user triggers within each batch
 *   transaction. This requires the connecting role to own the tables (or be
 *   superuser). Always rehearse on a staging copy before production.
 * - space_audit_log is append-only (its triggers reject UPDATE); this script
 *   disables those triggers to rewrite payload values in place. That is the
 *   deliberate, one-time exception to audit immutability called out in the
 *   design spec: the representation changes from plaintext to ciphertext,
 *   the content never does. The payload column is plain text holding the
 *   whole payload serialized to JSON, so an audit row is backfilled exactly
 *   like any other space-scoped text column — the entire JSON is encrypted as
 *   one blob under the row's space scope, which is exactly the context the
 *   audit reader (decryptAuditPayload) uses to decrypt and re-parse it.
 */
import { DataSource } from 'typeorm';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { AwsKmsService } from '@/datasources/kms/aws-kms.service';
import {
  ENCRYPTION_PREFIX,
  ENCRYPTION_VERSION,
} from '@/datasources/kms/encryption.constants';
import { KmsEncryptionService } from '@/datasources/kms/kms-encryption.service';

const BATCH_SIZE = 500;
// Bounds concurrent KMS Encrypt calls per batch; KMS comfortably handles this,
// and the DB connection is untouched until the (serial) write phase below.
const ENCRYPT_CONCURRENCY = 20;
// The exact on-disk prefix of an already-encrypted value. Matching only this
// (rather than the looser 'kms:%') means a malformed 'kms:'-prefixed value
// can't be mistaken for done: it stays visible to both the batch SELECTs
// below and countPlaintext's --verify check.
const ENCRYPTED_PREFIX = `${ENCRYPTION_PREFIX}:${ENCRYPTION_VERSION}:`;

interface ColumnSpec {
  /** Column holding the plaintext/ciphertext value. */
  column: string;
  /** Blind-index column populated alongside the value, when searchable. */
  indexColumn?: string;
}

interface TableSpec {
  table: string;
  /** Column holding the encryption-scope owner id. */
  scopeColumn: string;
  /** Encryption-context key the owner id binds to. */
  scopeKey: 'userId' | 'spaceId';
  columns: Array<ColumnSpec>;
}

/** Backfill order: users first, then the space-scoped tables. */
const TABLES: Array<TableSpec> = [
  {
    table: 'users',
    scopeColumn: 'id',
    scopeKey: 'userId',
    columns: [
      {
        column: 'email',
        indexColumn: 'email_index',
      },
    ],
  },
  {
    table: 'wallets',
    scopeColumn: 'user_id',
    scopeKey: 'userId',
    columns: [
      {
        column: 'address',
        indexColumn: 'address_index',
      },
    ],
  },
  {
    table: 'spaces',
    scopeColumn: 'id',
    scopeKey: 'spaceId',
    columns: [{ column: 'name' }],
  },
  {
    table: 'space_safes',
    scopeColumn: 'space_id',
    scopeKey: 'spaceId',
    columns: [
      {
        column: 'address',
        indexColumn: 'address_index',
      },
    ],
  },
  {
    table: 'space_address_book_items',
    scopeColumn: 'space_id',
    scopeKey: 'spaceId',
    columns: [
      {
        column: 'address',
        indexColumn: 'address_index',
      },
      { column: 'name' },
    ],
  },
  {
    table: 'address_book_requests',
    scopeColumn: 'space_id',
    scopeKey: 'spaceId',
    columns: [
      {
        column: 'address',
        indexColumn: 'address_index',
      },
      { column: 'name' },
    ],
  },
  {
    table: 'members',
    scopeColumn: 'space_id',
    scopeKey: 'spaceId',
    columns: [{ column: 'name' }, { column: 'alias' }],
  },
  // space_audit_log.payload is a single text column holding the whole audit
  // payload serialized to JSON, encrypted as one blob under the row's space
  // scope — structurally identical to spaces.name, so it rides the same path.
  // The table is append-only (its triggers reject UPDATE), but backfillTable's
  // DISABLE/ENABLE TRIGGER USER (used everywhere to preserve updated_at) also
  // lifts that guard for this deliberate, reviewed, one-time representation
  // rewrite (plaintext JSON -> ciphertext blob); content and shape are
  // unchanged. See the file docstring.
  {
    table: 'space_audit_log',
    scopeColumn: 'space_id',
    scopeKey: 'spaceId',
    columns: [{ column: 'payload' }],
  },
];

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
 * Forces `encryption.enabled` on regardless of
 * ENCRYPTION_ENABLED: this script's whole job is to produce
 * ciphertext, including when run before the fleet-wide flag flip (see the
 * file docstring), so KmsEncryptionService.encrypt must never take the
 * disabled/passthrough branch here. This also means onModuleInit will
 * require ENCRYPTION_INDEX_KEY to be set, which the backfill
 * needs anyway to compute real blind indexes.
 */
function buildConfigurationService(): IConfigurationService {
  const config = configuration();
  config.encryption.enabled = true;
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

/** SQL predicate: the column still holds a non-blank plaintext value. */
function needsEncryption(column: string): string {
  return `("${column}" IS NOT NULL AND "${column}" <> '' AND "${column}" NOT LIKE '${ENCRYPTED_PREFIX}%')`;
}

interface BackfillRow {
  id: number | string;
  scope_id: number;
  [column: string]: string | number | null;
}

async function backfillTable(
  dataSource: DataSource,
  fieldCrypto: KmsEncryptionService,
  spec: TableSpec,
): Promise<number> {
  const label = `${spec.table}.${spec.columns.map((c) => c.column).join('/')}`;
  let updated = 0;
  const runStartedAt = process.hrtime.bigint();
  const encryptDurationsMs: Array<number> = [];
  const batchWriteDurationsMs: Array<number> = [];

  const selectColumns = [`id`, `"${spec.scopeColumn}" AS scope_id`]
    .concat(spec.columns.map((c) => `"${c.column}"`))
    .join(', ');
  const anyNeedsEncryption = spec.columns
    .map((c) => needsEncryption(c.column))
    .join(' OR ');

  while (true) {
    // Blank values can never be encrypted (KMS rejects zero-length
    // plaintext) and are not values the app ever writes — invalid data,
    // excluded per column so it can't crash the batch or get re-selected
    // forever. They still show up in countPlaintext.
    const rows = await dataSource.query<Array<BackfillRow>>(
      `SELECT ${selectColumns} FROM "${spec.table}"
       WHERE ${anyNeedsEncryption}
       LIMIT $1`,
      [BATCH_SIZE],
    );
    if (rows.length === 0) {
      break;
    }

    // Encrypt is a KMS network round-trip and independent per value — do it
    // concurrently, outside the transaction, so DISABLE TRIGGER doesn't hold
    // for the sum of every value's KMS latency.
    const encryptedRows = await mapWithConcurrency(
      rows,
      ENCRYPT_CONCURRENCY,
      async (row) => {
        const context: Record<string, string> =
          spec.scopeKey === 'userId'
            ? { userId: String(row.scope_id) }
            : { spaceId: String(row.scope_id) };
        const assignments: Array<{ column: string; value: string | null }> = [];
        for (const columnSpec of spec.columns) {
          const value = row[columnSpec.column];
          // A row can hold a mix (e.g. name plaintext, alias already done or
          // NULL) — re-check per column what the SELECT checked per row.
          if (
            typeof value !== 'string' ||
            value === '' ||
            value.startsWith(ENCRYPTED_PREFIX)
          ) {
            continue;
          }
          const encryptStartedAt = process.hrtime.bigint();
          const encrypted = await fieldCrypto.encrypt(value, context);
          encryptDurationsMs.push(
            Number(process.hrtime.bigint() - encryptStartedAt) / 1e6,
          );
          assignments.push({ column: columnSpec.column, value: encrypted });
          if (columnSpec.indexColumn) {
            assignments.push({
              column: columnSpec.indexColumn,
              value: fieldCrypto.blindIndex(value),
            });
          }
        }
        return { id: row.id, assignments };
      },
    );

    const batchWriteStartedAt = process.hrtime.bigint();
    await dataSource.transaction(async (manager) => {
      // Preserves updated_at by suspending the touch trigger for the batch.
      // For space_audit_log this same switch also lifts the append-only guard
      // (the deliberate one-time exception documented in the file docstring).
      await manager.query(`ALTER TABLE "${spec.table}" DISABLE TRIGGER USER`);
      for (const row of encryptedRows) {
        if (row.assignments.length === 0) {
          continue;
        }
        const set = row.assignments
          .map((assignment, i) => `"${assignment.column}" = $${i + 1}`)
          .join(', ');
        await manager.query(
          `UPDATE "${spec.table}" SET ${set} WHERE id = $${row.assignments.length + 1}`,
          [...row.assignments.map((assignment) => assignment.value), row.id],
        );
      }
      await manager.query(`ALTER TABLE "${spec.table}" ENABLE TRIGGER USER`);
    });
    batchWriteDurationsMs.push(
      Number(process.hrtime.bigint() - batchWriteStartedAt) / 1e6,
    );

    updated += rows.length;
    process.stdout.write(`  ${label}: ${updated} rows encrypted\r`);
  }

  console.info(`  ${label}: ${updated} rows encrypted`);

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

async function countTablePlaintext(
  dataSource: DataSource,
  spec: TableSpec,
): Promise<number> {
  const label = `${spec.table}.${spec.columns.map((c) => c.column).join('/')}`;
  // A value that is not ciphertext — or an indexed column whose blind index
  // was never computed — has not been backfilled.
  const anyPlaintext = spec.columns
    .map((c) => {
      const valueBad = `"${c.column}" NOT LIKE '${ENCRYPTED_PREFIX}%'`;
      const indexBad = c.indexColumn ? ` OR "${c.indexColumn}" IS NULL` : '';
      return `("${c.column}" IS NOT NULL AND (${valueBad}${indexBad}))`;
    })
    .join(' OR ');
  const [{ count }] = await dataSource.query<Array<{ count: string }>>(
    `SELECT COUNT(*)::int AS count FROM "${spec.table}" WHERE ${anyPlaintext}`,
  );
  const remaining = Number(count);
  if (remaining > 0) {
    console.info(`  ${label}: ${remaining} plaintext/unindexed remaining`);
  }

  // Called out separately: blank values are skipped by backfillTable (KMS
  // can't encrypt zero-length plaintext) and re-running will never clear
  // them — they need a manual data fix (e.g. set to NULL) first.
  for (const columnSpec of spec.columns) {
    const [{ count: blankCount }] = await dataSource.query<
      Array<{ count: string }>
    >(
      `SELECT COUNT(*)::int AS count FROM "${spec.table}" WHERE "${columnSpec.column}" = ''`,
    );
    const blank = Number(blankCount);
    if (blank > 0) {
      console.info(
        `  ${spec.table}.${columnSpec.column}: ${blank} row(s) are blank — ` +
          `invalid data the backfill cannot encrypt; fix manually ` +
          `(e.g. set to NULL) before --verify can pass`,
      );
    }
  }

  return remaining;
}

async function countAllPlaintext(dataSource: DataSource): Promise<number> {
  let remaining = 0;
  for (const spec of TABLES) {
    remaining += await countTablePlaintext(dataSource, spec);
  }
  return remaining;
}

async function main(): Promise<void> {
  const verify = process.argv.includes('--verify');
  const dryRun = process.argv.includes('--dry-run');

  const configurationService = buildConfigurationService();
  const config = configuration();

  const fieldCrypto = new KmsEncryptionService(
    configurationService,
    new AwsKmsService(configurationService),
  );
  await fieldCrypto.onModuleInit();

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
      const remaining = await countAllPlaintext(dataSource);
      console.info(`Total plaintext remaining: ${remaining}`);
      if (verify && remaining > 0) {
        throw new Error(
          `${remaining} plaintext values remain; not safe to flip ` +
            `ENCRYPTION_ENABLED on (plaintext reads become a hard error)`,
        );
      }
      return;
    }

    console.info('Backfilling field encryption...');
    for (const spec of TABLES) {
      await backfillTable(dataSource, fieldCrypto, spec);
    }

    const remaining = await countAllPlaintext(dataSource);
    console.info(`Done. Plaintext remaining: ${remaining}`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
