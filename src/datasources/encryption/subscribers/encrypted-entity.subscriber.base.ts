// SPDX-License-Identifier: FSL-1.1-MIT
import { EncryptionLocator } from '@/datasources/encryption/encryption-locator';
import type {
  DataSource,
  EntitySubscriberInterface,
  InsertEvent,
  ObjectLiteral,
  UpdateEvent,
} from 'typeorm';

export interface EncryptedFieldConfig {
  /** Entity property that holds plaintext in memory and ciphertext in the DB */
  field: string;
  /** HMAC-SHA256 column for blind-index lookups without decrypting */
  hashField: string;
  /** Optional post-processing after decryption (e.g. getAddress for checksumming) */
  postDecrypt?: (value: string) => string;
}

/**
 * Shared column name for the DEK version that encrypted a row's fields.
 * One version column per entity suffices because no entity encrypts fields
 * with different DEK versions simultaneously.
 */
const ENCRYPTION_VERSION_FIELD = 'encryptionVersion';

/**
 * Base TypeORM subscriber for transparent field-level encryption.
 *
 * ## Why TypeORM subscribers?
 * Subscribers intercept entity lifecycle events at the ORM boundary, so
 * encryption/decryption is invisible to the rest of the application.
 * Repositories and services work with plaintext — the subscriber handles
 * the ciphertext ↔ plaintext translation automatically.
 *
 * ## Three-column pattern (ciphertext + hash + version)
 * Each encrypted field is backed by three DB columns:
 * - **ciphertext** (the field itself): AES-256-GCM encrypted value
 * - **hash**: HMAC-SHA256 blind index for equality lookups without decryption
 * - **encryptionVersion**: which DEK version produced the ciphertext,
 *   enabling key rotation and distinguishing encrypted rows from plaintext
 *   (`null` = legacy plaintext, no decryption needed)
 *
 * ## Feature flag behavior
 * - FF ON → encrypts on write, decrypts on read
 * - FF OFF + plaintext rows → no-op (pass-through)
 * - FF OFF + encrypted rows → throws (fail-fast, never return ciphertext as plaintext)
 */
export abstract class EncryptedEntitySubscriber<
  T extends ObjectLiteral,
> implements EntitySubscriberInterface<T> {
  protected abstract readonly fieldConfigs: Array<EncryptedFieldConfig>;

  constructor(dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  abstract listenTo(): new () => T;

  beforeInsert(event: InsertEvent<T>): void {
    this.encryptFields(event.entity);
  }

  beforeUpdate(event: UpdateEvent<T>): void {
    if (event.entity) {
      this.encryptFields(event.entity as T);
    }
  }

  afterLoad(entity: T): void {
    this.decryptFields(entity);
  }

  private encryptFields(entity: T): void {
    const service = EncryptionLocator.getServiceOrNull();
    if (!service) return;

    const record = entity as Record<string, unknown>;
    for (const config of this.fieldConfigs) {
      const plaintext = record[config.field];
      if (typeof plaintext !== 'string') continue;

      const { ciphertext, version } = service.encrypt(plaintext);
      record[config.field] = ciphertext;
      record[config.hashField] = service.hmac(plaintext);
      record[ENCRYPTION_VERSION_FIELD] = version;
    }
  }

  private decryptFields(entity: T): void {
    const record = entity as Record<string, unknown>;
    const version = record[ENCRYPTION_VERSION_FIELD] as
      | number
      | null
      | undefined;

    // null/undefined → legacy plaintext row, no decryption needed
    if (version == null) return;

    const service = EncryptionLocator.getServiceOrNull();
    if (!service) {
      throw new Error(
        'Encrypted data found but EncryptionService is not available. ' +
          'Enable the encryption feature flag or decrypt data before disabling.',
      );
    }

    for (const config of this.fieldConfigs) {
      const ciphertext = record[config.field];
      if (typeof ciphertext !== 'string') continue;

      let decrypted = service.decrypt(ciphertext, version);
      if (config.postDecrypt) {
        decrypted = config.postDecrypt(decrypted);
      }
      record[config.field] = decrypted;
    }
  }
}
