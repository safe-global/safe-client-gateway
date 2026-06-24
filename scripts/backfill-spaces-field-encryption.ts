// SPDX-License-Identifier: FSL-1.1-MIT
/**
 * Backfills per-entity field encryption over existing rows for the Spaces feature.
 *
 * Each space gets a data key (DEK) wrapped by KMS and stored in
 * `spaces.encrypted_data_key`; that key encrypts the space's `name`, its members'
 * `name`/`alias`, its address-book item/request names, and its audit-log payload
 * names. Each user with an email gets a per-user DEK in `users.encrypted_data_key`
 * encrypting the email value, plus a blind index in `users.email_index` for
 * uniqueness and lookups. Envelope encryption is performed app-side, so this
 * cannot be a pure SQL migration.
 *
 * Run AFTER deploying the code, running the column migrations, and enabling
 * encrypted writes with legacy plaintext reads still allowed:
 *
 *   SPACES_FIELD_ENCRYPTION_ENABLED=true \
 *   SPACES_FIELD_ENCRYPTION_ALLOW_LEGACY_PLAINTEXT=true \
 *   SPACES_FIELD_ENCRYPTION_CURRENT_KEY_ID=... \
 *   SPACES_FIELD_ENCRYPTION_INDEX_KEY_ID=... \
 *   SPACES_FIELD_ENCRYPTION_DATA_KEYS='{"1":"..."}' \
 *   AWS_KMS_ENCRYPTION_KEY_ID=... AWS_REGION=... \
 *     ts-node scripts/backfill-spaces-field-encryption.ts [--verify] [--dry-run]
 *
 *   --dry-run  Report how many rows still hold plaintext; write nothing.
 *   --verify   Assert no plaintext remains; exit non-zero if any does.
 *
 * Notes:
 * - Idempotent: rows already in `enc:` form are skipped (a validated plaintext
 *   name can never contain ':'). Space names are backfilled first so each space's
 *   key exists before its child rows are processed.
 * - `updated_at` is preserved and the audit immutability trigger is bypassed by
 *   disabling user triggers within each batch transaction. This requires the
 *   connecting role to own the tables (or be superuser). Always rehearse on a
 *   staging copy before running in production.
 *
 * Once this reports zero plaintext remaining, set
 * SPACES_FIELD_ENCRYPTION_ALLOW_LEGACY_PLAINTEXT=false.
 *
 * EMAIL CAVEAT (searchable field): users.email is encrypted non-deterministically
 * under a per-user key; uniqueness and equality lookups use the `email_index`
 * blind index. Once encryption is enabled, lookups match only rows whose
 * `email_index` is populated. Run the email backfill promptly after enabling (or
 * during a low-traffic window): between enabling and backfill completing, a
 * lookup for a not-yet-backfilled user's email will not match. If a zero-gap
 * transition is required, add dual-read (query plaintext `email` and the blind
 * index) to the email lookups for the duration of the backfill.
 */
import { DataSource } from 'typeorm';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { AwsKmsApiService } from '@/datasources/aws-kms/aws-kms-api.service';
import { EnvelopeKeyService } from '@/datasources/encryption/envelope-key.service';
import { FieldEncryptionAad } from '@/datasources/encryption/field-encryption.constants';
import { FieldEncryptionService } from '@/datasources/encryption/field-encryption.service';
import { PerEntityFieldCrypto } from '@/datasources/encryption/per-entity-field-crypto';
import {
  applyAuditPayloadNames,
  collectAuditPayloadNames,
} from '@/modules/spaces/domain/audit/entities/space-audit-event.encryption';
import {
  type SpaceAuditEventPayload,
  SpaceAuditEventType,
} from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';

const BATCH_SIZE = 500;

// Space-scoped name columns. `spaces.name` is processed first so each space's
// data key is minted before its child rows are backfilled.
const PER_SPACE_TARGETS = [
  {
    table: 'spaces',
    column: 'name',
    spaceIdColumn: 'id',
    aad: FieldEncryptionAad.SPACE_NAME,
  },
  {
    table: 'members',
    column: 'name',
    spaceIdColumn: 'space_id',
    aad: FieldEncryptionAad.MEMBER_NAME,
  },
  {
    table: 'members',
    column: 'alias',
    spaceIdColumn: 'space_id',
    aad: FieldEncryptionAad.MEMBER_ALIAS,
  },
  {
    table: 'space_address_book_items',
    column: 'name',
    spaceIdColumn: 'space_id',
    aad: FieldEncryptionAad.ADDRESS_BOOK_ITEM_NAME,
  },
  {
    table: 'address_book_requests',
    column: 'name',
    spaceIdColumn: 'space_id',
    aad: FieldEncryptionAad.ADDRESS_BOOK_REQUEST_NAME,
  },
] as const;

const PLAINTEXT_NAME_COLUMNS = PER_SPACE_TARGETS.map((target) => ({
  table: target.table,
  column: target.column,
}));

const AUDIT_NAME_EVENT_TYPES = [
  SpaceAuditEventType.SPACE_CREATED,
  SpaceAuditEventType.SPACE_UPDATED,
  SpaceAuditEventType.SPACE_DELETED,
  SpaceAuditEventType.ADDRESS_BOOK_UPSERTED,
  SpaceAuditEventType.ADDRESS_BOOK_DELETED,
];

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

/**
 * Loads (or, for `spaces`, mints-and-persists) the space's data key and encrypts
 * a row's name column under it. The space key is written in the same transaction.
 */
async function backfillPerSpaceColumn(
  dataSource: DataSource,
  fieldCrypto: PerEntityFieldCrypto,
  target: (typeof PER_SPACE_TARGETS)[number],
): Promise<number> {
  const { table, column, spaceIdColumn, aad } = target;
  let updated = 0;

  for (;;) {
    const rows = await dataSource.query<
      Array<{ id: number; value: string; space_id: number }>
    >(
      `SELECT id, "${column}" AS value, "${spaceIdColumn}" AS space_id
       FROM "${table}"
       WHERE "${column}" IS NOT NULL AND "${column}" NOT LIKE 'enc:%'
       LIMIT $1`,
      [BATCH_SIZE],
    );
    if (rows.length === 0) {
      break;
    }

    await dataSource.transaction(async (manager) => {
      await manager.query(`ALTER TABLE "${table}" DISABLE TRIGGER USER`);
      for (const row of rows) {
        const [space] = await manager.query<
          Array<{ encrypted_data_key: string | null }>
        >(`SELECT encrypted_data_key FROM "spaces" WHERE id = $1`, [
          row.space_id,
        ]);
        const existingKey = space?.encrypted_data_key ?? null;

        const { encryptedDataKey, values } = await fieldCrypto.encryptFields(
          { spaceId: String(row.space_id) },
          existingKey,
          [{ value: row.value, aad }],
        );

        if (table === 'spaces') {
          // The space row carries the key; set both together.
          await manager.query(
            `UPDATE "spaces" SET "${column}" = $1, encrypted_data_key = $2 WHERE id = $3`,
            [values[0], encryptedDataKey, row.id],
          );
        } else {
          // A child row of a space that was processed first already has a key;
          // persist a freshly minted one only in the (defensive) mint case.
          if (encryptedDataKey !== null && encryptedDataKey !== existingKey) {
            await manager.query(
              `UPDATE "spaces" SET encrypted_data_key = $1 WHERE id = $2`,
              [encryptedDataKey, row.space_id],
            );
          }
          await manager.query(
            `UPDATE "${table}" SET "${column}" = $1 WHERE id = $2`,
            [values[0], row.id],
          );
        }
      }
      await manager.query(`ALTER TABLE "${table}" ENABLE TRIGGER USER`);
    });

    updated += rows.length;
    process.stdout.write(`  ${table}.${column}: ${updated} encrypted\r`);
  }

  console.info(`  ${table}.${column}: ${updated} encrypted`);
  return updated;
}

async function backfillAuditPayloads(
  dataSource: DataSource,
  fieldCrypto: PerEntityFieldCrypto,
): Promise<number> {
  let updated = 0;
  let cursor = 0;
  const eventTypeList = AUDIT_NAME_EVENT_TYPES.map((t) => `'${t}'`).join(',');

  for (;;) {
    const rows = await dataSource.query<
      Array<{
        id: number;
        space_id: number;
        event_type: string;
        payload: SpaceAuditEventPayload;
      }>
    >(
      `SELECT id, space_id, event_type, payload FROM "space_audit_log"
       WHERE id > $1 AND event_type IN (${eventTypeList})
       ORDER BY id ASC LIMIT $2`,
      [cursor, BATCH_SIZE],
    );
    if (rows.length === 0) {
      break;
    }
    cursor = rows[rows.length - 1].id;

    const pending: Array<{ id: number; after: string }> = [];
    for (const row of rows) {
      const eventType = row.event_type as SpaceAuditEventType;
      const names = collectAuditPayloadNames(eventType, row.payload);
      const plaintextNames = names.filter(
        (name) => !fieldCrypto.isEncrypted(name),
      );
      if (plaintextNames.length === 0) {
        continue; // already encrypted (idempotent)
      }

      // Load (or defensively mint) the space key, then encrypt only the
      // not-yet-encrypted names, leaving any already-encrypted ones intact.
      const [space] = await dataSource.query<
        Array<{ encrypted_data_key: string | null }>
      >(`SELECT encrypted_data_key FROM "spaces" WHERE id = $1`, [
        row.space_id,
      ]);
      const { encryptedDataKey, values } = await fieldCrypto.encryptFields(
        { spaceId: String(row.space_id) },
        space?.encrypted_data_key ?? null,
        plaintextNames.map((name) => ({
          value: name,
          aad: FieldEncryptionAad.SPACE_AUDIT_NAME,
        })),
      );
      if (
        encryptedDataKey !== null &&
        encryptedDataKey !== (space?.encrypted_data_key ?? null)
      ) {
        await dataSource.query(
          `UPDATE "spaces" SET encrypted_data_key = $1 WHERE id = $2`,
          [encryptedDataKey, row.space_id],
        );
      }

      let valueCursor = 0;
      const encrypted = applyAuditPayloadNames(
        eventType,
        row.payload,
        (() => {
          const next = (name: string): string =>
            fieldCrypto.isEncrypted(name) ? name : values[valueCursor++];
          return names.map(next);
        })(),
      );
      pending.push({ id: row.id, after: JSON.stringify(encrypted) });
    }

    if (pending.length > 0) {
      await dataSource.transaction(async (manager) => {
        await manager.query(
          `ALTER TABLE "space_audit_log" DISABLE TRIGGER USER`,
        );
        for (const row of pending) {
          await manager.query(
            `UPDATE "space_audit_log" SET payload = $1 WHERE id = $2`,
            [row.after, row.id],
          );
        }
        await manager.query(
          `ALTER TABLE "space_audit_log" ENABLE TRIGGER USER`,
        );
      });
      updated += pending.length;
      process.stdout.write(`  space_audit_log.payload: ${updated} encrypted\r`);
    }
  }

  console.info(`  space_audit_log.payload: ${updated} encrypted`);
  return updated;
}

async function backfillUserEmails(
  dataSource: DataSource,
  fieldCrypto: PerEntityFieldCrypto,
): Promise<number> {
  let updated = 0;

  for (;;) {
    const rows = await dataSource.query<Array<{ id: number; email: string }>>(
      `SELECT id, email FROM "users"
       WHERE email IS NOT NULL AND email NOT LIKE 'enc:%'
       LIMIT $1`,
      [BATCH_SIZE],
    );
    if (rows.length === 0) {
      break;
    }

    await dataSource.transaction(async (manager) => {
      await manager.query(`ALTER TABLE "users" DISABLE TRIGGER USER`);
      for (const row of rows) {
        const emailIndex = fieldCrypto.blindIndex(row.email);
        const { encryptedDataKey, values } = await fieldCrypto.encryptFields(
          { userId: String(row.id) },
          null,
          [{ value: row.email, aad: FieldEncryptionAad.USER_EMAIL }],
        );
        await manager.query(
          `UPDATE "users"
           SET email = $1, email_index = $2, encrypted_data_key = $3
           WHERE id = $4`,
          [values[0], emailIndex, encryptedDataKey, row.id],
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
  let remaining = 0;
  for (const { table, column } of PLAINTEXT_NAME_COLUMNS) {
    const [{ count }] = await dataSource.query<Array<{ count: string }>>(
      `SELECT COUNT(*)::int AS count FROM "${table}"
       WHERE "${column}" IS NOT NULL AND "${column}" NOT LIKE 'enc:%'`,
    );
    const n = Number(count);
    if (n > 0) {
      console.info(`  ${table}.${column}: ${n} plaintext remaining`);
    }
    remaining += n;
  }

  // A user with an email but no blind index has not been backfilled.
  const [{ count: emailCount }] = await dataSource.query<
    Array<{ count: string }>
  >(
    `SELECT COUNT(*)::int AS count FROM "users"
     WHERE email IS NOT NULL AND (email NOT LIKE 'enc:%' OR email_index IS NULL)`,
  );
  const emails = Number(emailCount);
  if (emails > 0) {
    console.info(`  users.email: ${emails} plaintext/unindexed remaining`);
  }
  remaining += emails;

  return remaining;
}

async function main(): Promise<void> {
  const verify = process.argv.includes('--verify');
  const dryRun = process.argv.includes('--dry-run');

  const configurationService = buildConfigurationService();
  const config = configuration();

  const kmsApi = new AwsKmsApiService(configurationService);
  const fieldEncryptionService = new FieldEncryptionService(
    configurationService,
    kmsApi,
  );
  await fieldEncryptionService.onModuleInit();
  const envelopeKeyService = new EnvelopeKeyService(kmsApi);
  const fieldCrypto = new PerEntityFieldCrypto(
    envelopeKeyService,
    configurationService,
    fieldEncryptionService,
  );

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

    console.info('Backfilling per-space encrypted columns...');
    for (const target of PER_SPACE_TARGETS) {
      await backfillPerSpaceColumn(dataSource, fieldCrypto, target);
    }
    console.info('Backfilling audit payloads...');
    await backfillAuditPayloads(dataSource, fieldCrypto);
    console.info('Backfilling user emails...');
    await backfillUserEmails(dataSource, fieldCrypto);

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
