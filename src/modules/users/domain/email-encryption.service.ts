// SPDX-License-Identifier: FSL-1.1-MIT
import { createHmac } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IKmsService } from '@/datasources/kms/kms.service.interface';
import {
  BLIND_INDEX_LABEL,
  EMAIL_ENCRYPTION_PREFIX,
  EMAIL_ENCRYPTION_VERSION,
  EMAIL_FIELD,
  INDEX_KEY_LENGTH,
} from '@/modules/users/domain/email-encryption.constants';

/**
 * The single crypto policy for user-email field encryption, built on the
 * stateless {@link IKmsService}.
 *
 * - {@link encrypt}/{@link decrypt}: the email value is encrypted directly by
 *   KMS. The encryption context (`{ userId, field }`) is cryptographically
 *   bound into the ciphertext — decryption fails unless the identical context
 *   is presented, so a value cannot be transplanted to another user or column.
 * - {@link blindIndex}: deterministic keyed HMAC over the normalised email,
 *   stored in `users.email_index` so uniqueness and equality lookups keep
 *   working while the value itself is encrypted non-deterministically. Its key
 *   is KMS-wrapped in config and unwrapped once at boot.
 *
 * Encryption is gated centrally here so the repository can call it
 * unconditionally:
 * - disabled → plaintext passthrough (no KMS), though ciphertext reads still
 *   decrypt (rollback safety);
 * - enabled → values are always encrypted on write; reads decrypt ciphertext
 *   and, until the backfill completes, also tolerate a plaintext row by
 *   passing it through unchanged (see the `@todo` on {@link decrypt}).
 */
@Injectable()
export class EmailEncryptionService implements OnModuleInit {
  private readonly enabled: boolean;
  private readonly wrappedEmailIndexKey: string | undefined;
  /** Unwrapped blind-index key; populated on init whenever configured. */
  private emailIndexKey: Buffer | undefined;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IKmsService)
    private readonly kmsService: IKmsService,
  ) {
    this.enabled = this.configurationService.getOrThrow<boolean>(
      'spaces.fieldEncryption.enabled',
    );
    this.wrappedEmailIndexKey = this.configurationService.get<string>(
      'spaces.fieldEncryption.emailIndexKey',
    );
  }

  /**
   * Unwraps the configured blind-index key via KMS once, before requests are
   * served, so a misconfiguration fails at boot rather than on the first
   * write. Unwrapped whenever configured, even if encryption is disabled, so
   * existing blind indexes stay computable (e.g. after a rollback).
   */
  async onModuleInit(): Promise<void> {
    if (this.wrappedEmailIndexKey) {
      const plaintext = await this.kmsService.decrypt({
        ciphertext: Buffer.from(this.wrappedEmailIndexKey, 'base64'),
      });
      if (plaintext.length !== INDEX_KEY_LENGTH) {
        throw new Error(
          `The blind-index key must be ${INDEX_KEY_LENGTH} bytes, got ${plaintext.length}`,
        );
      }
      this.emailIndexKey = plaintext;
    }
    if (this.enabled && !this.emailIndexKey) {
      throw new Error(
        'spaces.fieldEncryption.emailIndexKey is required when field encryption is enabled',
      );
    }
  }

  isEncrypted(value: string): boolean {
    return value.startsWith(`${EMAIL_ENCRYPTION_PREFIX}:`);
  }

  /**
   * Deterministic keyed HMAC (base64url) over the normalised (trimmed,
   * lower-cased) input, used as a blind index for searchable/unique fields:
   * the same value always yields the same token, computable from the
   * plaintext alone, without revealing it. Gated on the index key being
   * configured, not on {@link enabled}: once encryption has run and rows
   * carry a blind index, disabling the flag again must not stop lookups from
   * matching them (rollback safety) — only whether *new* rows get encrypted
   * is gated on {@link enabled} (see {@link encrypt}). Returns `null` only
   * when no key is configured at all, in which case callers store/look up
   * the plaintext value directly.
   */
  blindIndex(plaintext: string): string | null {
    if (!this.emailIndexKey) {
      return null;
    }
    return createHmac('sha256', this.emailIndexKey)
      .update(BLIND_INDEX_LABEL)
      .update('\0')
      .update(plaintext.trim().toLowerCase(), 'utf8')
      .digest('base64url');
  }

  /**
   * Encrypts a user's email directly with KMS, bound to the owning user via
   * the encryption context. Returns the plaintext unchanged when encryption
   * is disabled. Stored form: `kms:v1:<base64url KMS ciphertext>` — the KMS
   * blob is self-describing (it embeds the KMS key id).
   */
  async encrypt(userId: number, email: string): Promise<string> {
    if (!this.enabled) {
      return email;
    }
    const ciphertext = await this.kmsService.encrypt({
      plaintext: Buffer.from(email, 'utf8'),
      encryptionContext: this.encryptionContext(userId),
    });
    return `${EMAIL_ENCRYPTION_PREFIX}:${EMAIL_ENCRYPTION_VERSION}:${ciphertext.toString('base64url')}`;
  }

  /**
   * Reverse of {@link encrypt}. `kms:` ciphertext is always decrypted.
   * Plaintext also passes through unchanged for now, whether encryption is
   * enabled or disabled — see the `@todo` below, this is temporary until the
   * backfill completes, at which point a plaintext row while enabled should
   * become a hard error again.
   */
  async decrypt(userId: number, value: string): Promise<string> {
    // @todo: Restore the `this.enabled` guard below (throw on plaintext once
    // enabled) once the backfill has completed. Until then, rows the
    // backfill hasn't reached yet are still plaintext, and the fleet must be
    // able to read them without error during the migration window.
    if (!this.isEncrypted(value)) {
      return value;
    }
    const parts = value.split(':');
    if (
      parts.length !== 3 ||
      parts[1] !== EMAIL_ENCRYPTION_VERSION ||
      !parts[2]
    ) {
      throw new Error('Malformed ciphertext');
    }
    const plaintext = await this.kmsService.decrypt({
      ciphertext: Buffer.from(parts[2], 'base64url'),
      encryptionContext: this.encryptionContext(userId),
    });
    return plaintext.toString('utf8');
  }

  /**
   * Returns copies of the given users with their `email` values decrypted
   * (one KMS call per encrypted value) via {@link decrypt}, so with
   * encryption enabled a plaintext row throws rather than leaking through.
   * The input is left untouched; users without an email are returned as-is.
   * Every repository that hands a user row out of the database must route it
   * through here.
   */
  async decryptUserEmails<T extends { id: number; email: string | null }>(
    users: Array<T>,
  ): Promise<Array<T>> {
    // Each decrypt is an independent KMS round-trip; run them concurrently
    // rather than paying an O(N) sequential latency tax on list reads.
    return await Promise.all(
      users.map(async (user) =>
        user.email
          ? {
              ...user,
              // The plaintext is the value originally validated as an
              // EmailAddress before encryption.
              email: (await this.decrypt(user.id, user.email)) as T['email'],
            }
          : user,
      ),
    );
  }

  private encryptionContext(userId: number): Record<string, string> {
    return { userId: String(userId), field: EMAIL_FIELD };
  }
}
