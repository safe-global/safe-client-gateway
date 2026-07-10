// SPDX-License-Identifier: FSL-1.1-MIT
import { createHmac } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { TtlLruCache } from '@/datasources/kms/field-crypto.cache';
import {
  BLIND_INDEX_LABEL,
  DECRYPT_CACHE_MAX_ENTRIES,
  DECRYPT_CACHE_TTL_MS,
  type EncryptedField,
  FIELD_ENCRYPTION_PREFIX,
  FIELD_ENCRYPTION_VERSION,
  type FieldScope,
  INDEX_KEY_LENGTH,
} from '@/datasources/kms/field-crypto.constants';
import { IKmsService } from '@/datasources/kms/kms.service.interface';

/**
 * The single crypto mechanics for all field-level encryption, built on the
 * stateless {@link IKmsService}. Per-entity policy (which field, which scope,
 * batch helpers) lives in thin wrappers: EmailEncryptionService,
 * WalletEncryptionService, MemberEncryptionService,
 * SpaceFieldEncryptionService.
 *
 * - {@link encrypt}/{@link decrypt}: the value is encrypted directly by KMS.
 *   The encryption context (`{ userId | spaceId, field }`) is
 *   cryptographically bound into the ciphertext — decryption fails unless the
 *   identical context is presented, so a value cannot be transplanted to
 *   another owner or column.
 * - {@link blindIndex}: deterministic keyed HMAC over the normalised value,
 *   stored in a sibling `*_index` column so uniqueness and equality lookups
 *   keep working while the value itself is encrypted non-deterministically.
 *   One shared key, domain-separated per field by an HMAC segment.
 * - {@link decrypt} results are cached in a bounded in-process LRU keyed by
 *   ciphertext. Never move this cache to Redis or any external store: that
 *   would persist plaintext at rest, recreating exactly the exposure this
 *   encryption removes.
 *
 * Encryption is gated centrally here so wrappers can call unconditionally:
 * - disabled → plaintext passthrough (no KMS), though ciphertext reads still
 *   decrypt (rollback safety);
 * - enabled → values are always encrypted on write; reads decrypt ciphertext
 *   and, until the backfill completes, also tolerate a plaintext row by
 *   passing it through unchanged (see the `@todo` on {@link decrypt}).
 */
@Injectable()
export class FieldCryptoService implements OnModuleInit {
  private readonly enabled: boolean;
  private readonly wrappedIndexKey: string | undefined;
  /** Unwrapped blind-index key; populated on init whenever configured. */
  private indexKey: Buffer | undefined;
  private readonly decryptCache = new TtlLruCache<string>(
    DECRYPT_CACHE_MAX_ENTRIES,
    DECRYPT_CACHE_TTL_MS,
  );

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IKmsService)
    private readonly kmsService: IKmsService,
  ) {
    this.enabled = this.configurationService.getOrThrow<boolean>(
      'spaces.fieldEncryption.enabled',
    );
    this.wrappedIndexKey = this.configurationService.get<string>(
      'spaces.fieldEncryption.indexKey',
    );
  }

  /**
   * Unwraps the configured blind-index key via KMS once, before requests are
   * served, so a misconfiguration fails at boot rather than on the first
   * write. Unwrapped whenever configured, even if encryption is disabled, so
   * existing blind indexes stay computable (e.g. after a rollback).
   */
  async onModuleInit(): Promise<void> {
    if (this.wrappedIndexKey) {
      const plaintext = await this.kmsService.decrypt({
        ciphertext: Buffer.from(this.wrappedIndexKey, 'base64'),
      });
      if (plaintext.length !== INDEX_KEY_LENGTH) {
        throw new Error(
          `The blind-index key must be ${INDEX_KEY_LENGTH} bytes, got ${plaintext.length}`,
        );
      }
      this.indexKey = plaintext;
    }
    if (this.enabled && !this.indexKey) {
      throw new Error(
        'spaces.fieldEncryption.indexKey is required when field encryption is enabled',
      );
    }
  }

  isEncrypted(value: string): boolean {
    return value.startsWith(`${FIELD_ENCRYPTION_PREFIX}:`);
  }

  /**
   * Encrypts a field value directly with KMS, bound to its owner and column
   * via the encryption context. Returns the plaintext unchanged when
   * encryption is disabled. Stored form: `kms:v1:<base64url KMS ciphertext>`.
   */
  async encrypt(
    field: EncryptedField,
    scope: FieldScope,
    value: string,
  ): Promise<string> {
    if (!this.enabled) {
      return value;
    }
    const ciphertext = await this.kmsService.encrypt({
      plaintext: Buffer.from(value, 'utf8'),
      encryptionContext: this.encryptionContext(field, scope),
    });
    return `${FIELD_ENCRYPTION_PREFIX}:${FIELD_ENCRYPTION_VERSION}:${ciphertext.toString('base64url')}`;
  }

  /**
   * Reverse of {@link encrypt}. `kms:` ciphertext is always decrypted (and
   * cached). Plaintext also passes through unchanged for now, whether
   * encryption is enabled or disabled — temporary until the backfill
   * completes, at which point a plaintext value while enabled should become
   * a hard error again.
   */
  async decrypt(
    field: EncryptedField,
    scope: FieldScope,
    value: string,
  ): Promise<string> {
    // @todo: Throw on plaintext when `this.enabled` once the backfill has
    // completed (all fields, all tables). Until then, rows the backfill
    // hasn't reached yet are still plaintext, and the fleet must be able to
    // read them without error during the migration window.
    if (!this.isEncrypted(value)) {
      return value;
    }
    const cached = this.decryptCache.get(value);
    if (cached !== undefined) {
      return cached;
    }
    const parts = value.split(':');
    if (
      parts.length !== 3 ||
      parts[1] !== FIELD_ENCRYPTION_VERSION ||
      !parts[2]
    ) {
      throw new Error('Malformed ciphertext');
    }
    const plaintext = await this.kmsService.decrypt({
      ciphertext: Buffer.from(parts[2], 'base64url'),
      encryptionContext: this.encryptionContext(field, scope),
    });
    const decoded = plaintext.toString('utf8');
    this.decryptCache.set(value, decoded);
    return decoded;
  }

  /**
   * Deterministic keyed HMAC (base64url) over the normalised (trimmed,
   * lower-cased) input, domain-separated by the field id, used as a blind
   * index for searchable/unique columns. Gated on the index key being
   * configured, not on {@link enabled}: once rows carry a blind index,
   * disabling the flag again must not stop lookups from matching them
   * (rollback safety). Returns `null` only when no key is configured at all,
   * in which case callers store/look up the plaintext value directly.
   */
  blindIndex(field: EncryptedField, value: string): string | null {
    if (!this.indexKey) {
      return null;
    }
    return createHmac('sha256', this.indexKey)
      .update(BLIND_INDEX_LABEL)
      .update('\0')
      .update(field, 'utf8')
      .update('\0')
      .update(value.trim().toLowerCase(), 'utf8')
      .digest('base64url');
  }

  /**
   * The users.email blind index predates the field segment; its stored form
   * is an immutable on-disk contract. Only EmailEncryptionService calls this.
   */
  emailBlindIndex(value: string): string | null {
    if (!this.indexKey) {
      return null;
    }
    return createHmac('sha256', this.indexKey)
      .update(BLIND_INDEX_LABEL)
      .update('\0')
      .update(value.trim().toLowerCase(), 'utf8')
      .digest('base64url');
  }

  private encryptionContext(
    field: EncryptedField,
    scope: FieldScope,
  ): Record<string, string> {
    return 'userId' in scope
      ? { userId: String(scope.userId), field }
      : { spaceId: String(scope.spaceId), field };
  }
}
