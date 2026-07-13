// SPDX-License-Identifier: FSL-1.1-MIT
import { createHmac } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  BLIND_INDEX_LABEL,
  ENCRYPTION_PREFIX,
  ENCRYPTION_VERSION,
  INDEX_KEY_LENGTH,
} from '@/datasources/kms/encryption.constants';
import { IKmsService } from '@/datasources/kms/kms.service.interface';

/**
 * The single, domain-free crypto mechanics for all field-level encryption,
 * built on the stateless {@link IKmsService}. Per-entity policy (which owner,
 * how to shape the context, batch helpers) lives in thin wrappers:
 * EmailEncryptionService, WalletEncryptionService, MemberEncryptionService,
 * SpaceFieldEncryptionService — this service knows nothing about scopes.
 *
 * - {@link encrypt}/{@link decrypt}: the value is encrypted directly by KMS.
 *   The caller-supplied `encryptionContext` is passed straight to KMS as AAD
 *   and cryptographically bound into the ciphertext — decryption fails unless
 *   the identical context is presented, so a value cannot be transplanted to
 *   another owner. Wrappers own the context shape and bind the owning row's id
 *   into it (e.g. `{ userId }` or `{ spaceId }`).
 * - {@link blindIndex}: deterministic keyed HMAC over the normalised value,
 *   stored in a sibling `*_index` column so uniqueness and equality lookups
 *   keep working while the value itself is encrypted non-deterministically.
 *   One global HMAC domain and one shared key.
 *
 * Encryption is gated centrally here so wrappers can call unconditionally:
 * - disabled → plaintext passthrough (no KMS), though ciphertext reads still
 *   decrypt (rollback safety);
 * - enabled → values are always encrypted on write; reads decrypt ciphertext
 *   and, until the backfill completes, also tolerate a plaintext row by
 *   passing it through unchanged (see the `@todo` on {@link decrypt}).
 */
@Injectable()
export class KmsEncryptionService implements OnModuleInit {
  private readonly enabled: boolean;
  private readonly wrappedIndexKey: string | undefined;
  /** Unwrapped blind-index key; populated on init whenever configured. */
  private indexKey: Buffer | undefined;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IKmsService)
    private readonly kmsService: IKmsService,
  ) {
    this.enabled =
      this.configurationService.getOrThrow<boolean>('encryption.enabled');
    this.wrappedIndexKey = this.configurationService.get<string>(
      'encryption.indexKey',
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
  }

  isEncrypted(value: string): boolean {
    return value.startsWith(`${ENCRYPTION_PREFIX}:`);
  }

  /**
   * Encrypts a value directly with KMS, bound to the caller-supplied
   * `encryptionContext` (passed to KMS as AAD). Returns the plaintext
   * unchanged when encryption is disabled. Stored form:
   * `kms:v1:<base64url KMS ciphertext>`.
   */
  async encrypt(
    value: string,
    encryptionContext: Record<string, string>,
  ): Promise<string> {
    if (!this.enabled) {
      return value;
    }
    const ciphertext = await this.kmsService.encrypt({
      plaintext: Buffer.from(value, 'utf8'),
      encryptionContext,
    });
    return `${ENCRYPTION_PREFIX}:${ENCRYPTION_VERSION}:${ciphertext.toString('base64url')}`;
  }

  /**
   * Reverse of {@link encrypt}. `kms:` ciphertext is always decrypted, using
   * the caller-supplied `encryptionContext` as AAD. Plaintext also passes
   * through unchanged for now, whether encryption is enabled or disabled —
   * temporary until the backfill completes, at which point a plaintext value
   * while enabled should become a hard error again.
   */
  async decrypt(
    value: string,
    encryptionContext: Record<string, string>,
  ): Promise<string> {
    // @todo: Throw on plaintext when `this.enabled` once the backfill has
    // completed (all fields, all tables). See scripts/backfill-field-encryption.
    if (!this.isEncrypted(value)) {
      return value;
    }
    const parts = value.split(':');
    if (parts.length !== 3 || parts[1] !== ENCRYPTION_VERSION || !parts[2]) {
      throw new Error('Malformed ciphertext');
    }
    const plaintext = await this.kmsService.decrypt({
      ciphertext: Buffer.from(parts[2], 'base64url'),
      encryptionContext,
    });
    return plaintext.toString('utf8');
  }

  /**
   * Deterministic keyed HMAC (base64url) over the normalised (trimmed,
   * lower-cased) input, over a single global HMAC domain, used as a blind
   * index for searchable/unique columns. Gated on the index key being
   * configured, not on {@link enabled}: once rows carry a blind index,
   * disabling the flag again must not stop lookups from matching them
   * (rollback safety). Returns `null` only when no key is configured at all,
   * in which case callers store/look up the plaintext value directly.
   */
  blindIndex(value: string): string | null {
    if (!this.indexKey) {
      return null;
    }
    return createHmac('sha256', this.indexKey)
      .update(BLIND_INDEX_LABEL)
      .update('\0')
      .update(value.trim().toLowerCase(), 'utf8')
      .digest('base64url');
  }
}
