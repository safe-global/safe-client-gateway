// SPDX-License-Identifier: FSL-1.1-MIT
import type { IFieldEncryptionService } from '@/datasources/encryption/encryption.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type {
  DataSource,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
  ObjectLiteral,
} from 'typeorm';

interface AddressFieldConfig {
  /** The field on the entity (e.g. 'address') — stores plaintext in memory, ciphertext in DB */
  field: string;
  /** The HMAC hash column (e.g. 'addressHash') */
  hashField: string;
  /** Post-processing after decryption (e.g. getAddress for checksumming) */
  postDecrypt?: (value: string) => string;
}

/**
 * Base TypeORM subscriber that transparently encrypts/decrypts address fields in-place.
 *
 * Concrete subscribers extend this class and declare which fields to encrypt
 * via {@link fieldConfigs}. The subscriber hooks into TypeORM lifecycle events:
 * - `beforeInsert`/`beforeUpdate`: encrypts plaintext in-place + sets hash
 * - `afterLoad`: decrypts ciphertext in-place (dual-read: keeps plaintext if not encrypted)
 */
export abstract class EncryptedEntitySubscriber<
  T extends ObjectLiteral,
> implements EntitySubscriberInterface<T> {
  protected abstract readonly fieldConfigs: Array<AddressFieldConfig>;

  constructor(
    protected readonly encryptionService: IFieldEncryptionService,
    protected readonly loggingService: ILoggingService,
    dataSource: DataSource,
  ) {
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
    const record = entity as Record<string, unknown>;
    for (const config of this.fieldConfigs) {
      const plaintext = record[config.field];
      if (typeof plaintext !== 'string') {
        continue;
      }

      record[config.hashField] = this.encryptionService.hmac(plaintext);
      record[config.field] = this.encryptionService.encrypt(plaintext);
    }
  }

  private decryptFields(entity: T): void {
    const record = entity as Record<string, unknown>;
    for (const config of this.fieldConfigs) {
      const value = record[config.field];
      if (typeof value !== 'string') {
        continue;
      }

      // Dual-read: only decrypt if the value has the v1: prefix
      if (!value.startsWith('v1:')) {
        continue;
      }

      let decrypted = this.encryptionService.decrypt(value);
      if (config.postDecrypt) {
        decrypted = config.postDecrypt(decrypted);
      }
      record[config.field] = decrypted;
    }
  }
}
