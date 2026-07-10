// SPDX-License-Identifier: FSL-1.1-MIT
/**
 * Backfills KMS field encryption over existing rows of every encrypted field.
 *
 * Tables and fields, in run order:
 *
 *   users.email                       + email_index (legacy construction)
 *   wallets.address                   + address_index
 *   spaces.name
 *   space_safes.address               + address_index
 *   space_address_book_items.address  + address_index
 *   space_address_book_items.name
 *   address_book_requests.address     + address_index
 *   address_book_requests.name
 *   members.name, members.alias
 *   space_audit_log.payload           (embedded name/address values)
 *
 * Each plaintext value is encrypted directly by KMS, bound to its owner via
 * the KMS encryption context ({ userId } for users/wallets, { spaceId } for
 * everything else, plus the field id). Searchable address columns also get a
 * blind index; blind indexes cannot be computed in SQL, so this cannot be a
 * pure SQL migration.
 *
 * Release choreography (2026-07-10 expansion spec): deploy the code with
 * encryption disabled, run both column migrations, enable
 * SPACES_FIELD_ENCRYPTION_ENABLED (new writes encrypt; plaintext rows still
 * read through the temporary passthrough and the dual-read lookups), then run
 * this script until --verify passes:
 *
 *   SPACES_FIELD_ENCRYPTION_INDEX_KEY=... \
 *   AWS_KMS_ENCRYPTION_KEY_ID=... AWS_REGION=... \
 *     ts-node scripts/backfill-field-encryption.ts [--verify] [--dry-run]
 *
 *   --dry-run  Report how many rows still hold plaintext, per table; write
 *              nothing.
 *   --verify   Assert no plaintext remains anywhere; exit non-zero if any
 *              table still has plaintext.
 *
 * This script always encrypts via KMS — it forces field encryption on for
 * itself regardless of SPACES_FIELD_ENCRYPTION_ENABLED, so the fleet's flag
 * state is irrelevant to it. Rows written by a still-disabled fleet after a
 * backfill pass remain plaintext: re-run this same command until --verify
 * passes; the dual-read lookups and the plaintext read passthrough keep such
 * stragglers working in the meantime.
 *
 * ONLY after --verify exits 0 (in the target environment) may the temporary
 * read tolerance be removed: the plaintext-passthrough `@todo` in
 * FieldCryptoService.decrypt and the dual-read plaintext arms in the
 * repositories (each marked with a "throw-on-plaintext" comment). That flip
 * is deliberately NOT part of the rollout PRs.
 *
 * Notes:
 * - Idempotent: values already in `kms:v1:` form are skipped. Matching the
 *   exact prefix (rather than the looser 'kms:%') means a malformed
 *   'kms:'-prefixed value can't be mistaken for done: it stays visible to
 *   the batch SELECTs and --verify, and gets encrypted as an opaque string.
 * - Each value costs one KMS Encrypt call — budget KMS rate limits.
 * - `updated_at` is preserved by disabling user triggers within each batch
 *   transaction. This requires the connecting role to own the tables (or be
 *   superuser). Always rehearse on a staging copy before production.
 * - space_audit_log is append-only (its triggers reject UPDATE); this script
 *   disables those triggers to rewrite payload values in place. That is the
 *   deliberate, one-time exception to audit immutability called out in the
 *   design spec: the representation changes from plaintext to ciphertext,
 *   the content never does. Because source rows may since have been deleted
 *   (SAFE_REMOVED, ADDRESS_BOOK_DELETED, SPACE_DELETED), the writers' rule
 *   of carrying the source row's ciphertext into the payload is impossible
 *   for historical rows — this is the one place the backfill mints fresh
 *   ciphertext for audit data, under the payload's field id and the row's
 *   own space scope, which is exactly the context the audit reader
 *   (decryptAuditPayload) reconstructs.
 */
import { DataSource } from 'typeorm';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { AwsKmsService } from '@/datasources/kms/aws-kms.service';
import type {
  EncryptedField,
  FieldScope,
} from '@/datasources/kms/field-crypto.constants';
import {
  FIELD_ENCRYPTION_PREFIX,
  FIELD_ENCRYPTION_VERSION,
} from '@/datasources/kms/field-crypto.constants';
import { FieldCryptoService } from '@/datasources/kms/field-crypto.service';

const BATCH_SIZE = 500;
// Bounds concurrent KMS Encrypt calls per batch; KMS comfortably handles this,
// and the DB connection is untouched until the (serial) write phase below.
const ENCRYPT_CONCURRENCY = 20;
// The exact on-disk prefix of an already-encrypted value. Matching only this
// (rather than the looser 'kms:%') means a malformed 'kms:'-prefixed value
// can't be mistaken for done: it stays visible to both the batch SELECTs
// below and countPlaintext's --verify check.
const ENCRYPTED_PREFIX = `${FIELD_ENCRYPTION_PREFIX}:${FIELD_ENCRYPTION_VERSION}:`;

interface ColumnSpec {
  /** Column holding the plaintext/ciphertext value. */
  column: string;
  /** Field id bound into the KMS encryption context. */
  field: EncryptedField;
  /** Blind-index column populated alongside the value, when searchable. */
  indexColumn?: string;
  /**
   * users.email predates the field-segmented blind index; its legacy
   * construction (no field segment) is an immutable on-disk contract.
   */
  legacyEmailIndex?: boolean;
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
        field: 'users.email',
        indexColumn: 'email_index',
        legacyEmailIndex: true,
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
        field: 'wallets.address',
        indexColumn: 'address_index',
      },
    ],
  },
  {
    table: 'spaces',
    scopeColumn: 'id',
    scopeKey: 'spaceId',
    columns: [{ column: 'name', field: 'spaces.name' }],
  },
  {
    table: 'space_safes',
    scopeColumn: 'space_id',
    scopeKey: 'spaceId',
    columns: [
      {
        column: 'address',
        field: 'space_safes.address',
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
        field: 'space_address_book_items.address',
        indexColumn: 'address_index',
      },
      { column: 'name', field: 'space_address_book_items.name' },
    ],
  },
  {
    table: 'address_book_requests',
    scopeColumn: 'space_id',
    scopeKey: 'spaceId',
    columns: [
      {
        column: 'address',
        field: 'address_book_requests.address',
        indexColumn: 'address_index',
      },
      { column: 'name', field: 'address_book_requests.name' },
    ],
  },
  {
    table: 'members',
    scopeColumn: 'space_id',
    scopeKey: 'spaceId',
    columns: [
      { column: 'name', field: 'members.name' },
      { column: 'alias', field: 'members.alias' },
    ],
  },
];

const AUDIT_TABLE = 'space_audit_log';

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
 * file docstring), so FieldCryptoService.encrypt must never take the
 * disabled/passthrough branch here. This also means onModuleInit will
 * require SPACES_FIELD_ENCRYPTION_INDEX_KEY to be set, which the backfill
 * needs anyway to compute real blind indexes.
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
  fieldCrypto: FieldCryptoService,
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
        const scope: FieldScope =
          spec.scopeKey === 'userId'
            ? { userId: Number(row.scope_id) }
            : { spaceId: Number(row.scope_id) };
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
          const encrypted = await fieldCrypto.encrypt(
            columnSpec.field,
            scope,
            value,
          );
          encryptDurationsMs.push(
            Number(process.hrtime.bigint() - encryptStartedAt) / 1e6,
          );
          assignments.push({ column: columnSpec.column, value: encrypted });
          if (columnSpec.indexColumn) {
            assignments.push({
              column: columnSpec.indexColumn,
              value: columnSpec.legacyEmailIndex
                ? fieldCrypto.emailBlindIndex(value)
                : fieldCrypto.blindIndex(columnSpec.field, value),
            });
          }
        }
        return { id: row.id, assignments };
      },
    );

    const batchWriteStartedAt = process.hrtime.bigint();
    await dataSource.transaction(async (manager) => {
      // Preserves updated_at by suspending the touch trigger for the batch.
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

/**
 * SQL predicate matching audit rows whose payload still embeds at least one
 * non-blank plaintext name/address for the encrypted event types. Reused by
 * both the batch SELECT (so rewritten rows drop out and the loop terminates)
 * and the --verify count.
 */
const AUDIT_PLAINTEXT_PREDICATE = `
  (event_type IN ('SPACE_CREATED', 'SPACE_DELETED')
    AND payload->>'name' IS NOT NULL AND payload->>'name' <> ''
    AND payload->>'name' NOT LIKE '${ENCRYPTED_PREFIX}%')
  OR (event_type = 'SPACE_UPDATED' AND (
    (payload->'old'->>'name' IS NOT NULL AND payload->'old'->>'name' <> ''
      AND payload->'old'->>'name' NOT LIKE '${ENCRYPTED_PREFIX}%')
    OR (payload->'new'->>'name' IS NOT NULL AND payload->'new'->>'name' <> ''
      AND payload->'new'->>'name' NOT LIKE '${ENCRYPTED_PREFIX}%')))
  OR (event_type IN ('SAFE_ADDED', 'SAFE_REMOVED')
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(payload->'safes', '[]'::jsonb)) AS safe
      WHERE safe->>'address' IS NOT NULL AND safe->>'address' <> ''
        AND safe->>'address' NOT LIKE '${ENCRYPTED_PREFIX}%'))
  OR (event_type = 'ADDRESS_BOOK_UPSERTED'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        COALESCE(payload->'created', '[]'::jsonb)
          || COALESCE(payload->'updated', '[]'::jsonb)
      ) AS entry
      WHERE (entry->>'address' IS NOT NULL AND entry->>'address' <> ''
          AND entry->>'address' NOT LIKE '${ENCRYPTED_PREFIX}%')
        OR (entry->>'name' IS NOT NULL AND entry->>'name' <> ''
          AND entry->>'name' NOT LIKE '${ENCRYPTED_PREFIX}%')))
  OR (event_type = 'ADDRESS_BOOK_DELETED'
    AND ((payload->>'address' IS NOT NULL AND payload->>'address' <> ''
        AND payload->>'address' NOT LIKE '${ENCRYPTED_PREFIX}%')
      OR (payload->>'name' IS NOT NULL AND payload->>'name' <> ''
        AND payload->>'name' NOT LIKE '${ENCRYPTED_PREFIX}%')))
`;

type JsonObject = Record<string, unknown>;

interface AuditRow {
  id: string;
  space_id: number;
  event_type: string;
  payload: JsonObject;
}

async function encryptPayloadValue(
  fieldCrypto: FieldCryptoService,
  field: EncryptedField,
  spaceId: number,
  holder: JsonObject,
  key: string,
): Promise<boolean> {
  const value = holder[key];
  if (
    typeof value !== 'string' ||
    value === '' ||
    value.startsWith(ENCRYPTED_PREFIX)
  ) {
    return false;
  }
  holder[key] = await fieldCrypto.encrypt(field, { spaceId }, value);
  return true;
}

interface FieldKey {
  field: EncryptedField;
  key: string;
}

/** Encrypts each of `fields` on a single payload object, in place. */
async function rewriteObjectFields(
  fieldCrypto: FieldCryptoService,
  spaceId: number,
  holder: unknown,
  fields: Array<FieldKey>,
): Promise<boolean> {
  if (!holder || typeof holder !== 'object' || Array.isArray(holder)) {
    return false;
  }
  let changed = false;
  for (const { field, key } of fields) {
    changed =
      (await encryptPayloadValue(
        fieldCrypto,
        field,
        spaceId,
        holder as JsonObject,
        key,
      )) || changed;
  }
  return changed;
}

/** Encrypts `fields` on every object of an array-valued payload member. */
async function rewriteEntryList(
  fieldCrypto: FieldCryptoService,
  spaceId: number,
  list: unknown,
  fields: Array<FieldKey>,
): Promise<boolean> {
  if (!Array.isArray(list)) {
    return false;
  }
  let changed = false;
  for (const entry of list) {
    changed =
      (await rewriteObjectFields(fieldCrypto, spaceId, entry, fields)) ||
      changed;
  }
  return changed;
}

/**
 * Returns the payload with every embedded plaintext name/address freshly
 * encrypted under the payload's field id and the row's space scope, or null
 * when nothing needed rewriting. See the file docstring for why the audit
 * backfill mints new ciphertext instead of reusing the source rows'.
 */
async function rewriteAuditPayload(
  fieldCrypto: FieldCryptoService,
  row: AuditRow,
): Promise<JsonObject | null> {
  const payload = structuredClone(row.payload);
  const spaceId = row.space_id;
  const addressBookFields: Array<FieldKey> = [
    { field: 'space_address_book_items.address', key: 'address' },
    { field: 'space_address_book_items.name', key: 'name' },
  ];
  let changed = false;

  switch (row.event_type) {
    case 'SPACE_CREATED':
    case 'SPACE_DELETED':
      changed = await rewriteObjectFields(fieldCrypto, spaceId, payload, [
        { field: 'spaces.name', key: 'name' },
      ]);
      break;
    case 'SPACE_UPDATED':
      for (const side of ['old', 'new'] as const) {
        changed =
          (await rewriteObjectFields(fieldCrypto, spaceId, payload[side], [
            { field: 'spaces.name', key: 'name' },
          ])) || changed;
      }
      break;
    case 'SAFE_ADDED':
    case 'SAFE_REMOVED':
      changed = await rewriteEntryList(fieldCrypto, spaceId, payload.safes, [
        { field: 'space_safes.address', key: 'address' },
      ]);
      break;
    case 'ADDRESS_BOOK_UPSERTED':
      for (const listKey of ['created', 'updated'] as const) {
        changed =
          (await rewriteEntryList(
            fieldCrypto,
            spaceId,
            payload[listKey],
            addressBookFields,
          )) || changed;
      }
      break;
    case 'ADDRESS_BOOK_DELETED':
      changed = await rewriteObjectFields(
        fieldCrypto,
        spaceId,
        payload,
        addressBookFields,
      );
      break;
  }

  return changed ? payload : null;
}

async function backfillAuditPayloads(
  dataSource: DataSource,
  fieldCrypto: FieldCryptoService,
): Promise<number> {
  let updated = 0;

  while (true) {
    const rows = await dataSource.query<Array<AuditRow>>(
      `SELECT id, space_id, event_type, payload FROM "${AUDIT_TABLE}"
       WHERE ${AUDIT_PLAINTEXT_PREDICATE}
       LIMIT $1`,
      [BATCH_SIZE],
    );
    if (rows.length === 0) {
      break;
    }

    const rewritten = await mapWithConcurrency(
      rows,
      ENCRYPT_CONCURRENCY,
      async (row) => ({
        id: row.id,
        payload: await rewriteAuditPayload(fieldCrypto, row),
      }),
    );

    // Termination guard: every selected row must produce a rewrite, or the
    // same rows would be re-selected forever. A row matching the SQL
    // predicate but yielding no JS rewrite means malformed payload data.
    if (rewritten.every((row) => row.payload === null)) {
      throw new Error(
        `${AUDIT_TABLE} rows match the plaintext predicate but produced no ` +
          `rewrite (ids: ${rows
            .slice(0, 10)
            .map((row) => row.id)
            .join(', ')}); fix the payload data before re-running`,
      );
    }

    await dataSource.transaction(async (manager) => {
      // The audit table's user triggers reject UPDATE by design (append-
      // only). Disabling them here is the deliberate, one-time, reviewed
      // exception from the design spec: this rewrite changes representation
      // (plaintext -> ciphertext), never content or shape.
      await manager.query(`ALTER TABLE "${AUDIT_TABLE}" DISABLE TRIGGER USER`);
      for (const row of rewritten) {
        if (!row.payload) {
          continue;
        }
        await manager.query(
          `UPDATE "${AUDIT_TABLE}" SET payload = $1::jsonb WHERE id = $2`,
          [JSON.stringify(row.payload), row.id],
        );
      }
      await manager.query(`ALTER TABLE "${AUDIT_TABLE}" ENABLE TRIGGER USER`);
    });

    updated += rows.length;
    process.stdout.write(`  ${AUDIT_TABLE}.payload: ${updated} rewritten\r`);
  }

  console.info(`  ${AUDIT_TABLE}.payload: ${updated} rewritten`);
  return updated;
}

async function countAuditPlaintext(dataSource: DataSource): Promise<number> {
  const [{ count }] = await dataSource.query<Array<{ count: string }>>(
    `SELECT COUNT(*)::int AS count FROM "${AUDIT_TABLE}"
     WHERE ${AUDIT_PLAINTEXT_PREDICATE}`,
  );
  const remaining = Number(count);
  if (remaining > 0) {
    console.info(
      `  ${AUDIT_TABLE}.payload: ${remaining} plaintext payload(s) remaining`,
    );
  }
  return remaining;
}

async function countAllPlaintext(dataSource: DataSource): Promise<number> {
  let remaining = 0;
  for (const spec of TABLES) {
    remaining += await countTablePlaintext(dataSource, spec);
  }
  remaining += await countAuditPlaintext(dataSource);
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
          `${remaining} plaintext values remain; not safe to restore the ` +
            `throw-on-plaintext guard or remove the dual-read arms`,
        );
      }
      return;
    }

    console.info('Backfilling field encryption...');
    for (const spec of TABLES) {
      await backfillTable(dataSource, fieldCrypto, spec);
    }
    await backfillAuditPayloads(dataSource, fieldCrypto);

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
